import numpy as np
import scipy.ndimage
import scipy.signal
import torch
import torch.nn as nn

FS = 250       # Icentia11k sampling rate (Hz)
WINDOW = 500   # 2 s per model input

# 4th-order Butterworth band-pass, 0.5-45 Hz: removes baseline wander and high-frequency noise
_B, _A = scipy.signal.butter(4, [0.5 / (0.5 * FS), 45.0 / (0.5 * FS)], btype='band')


def preprocess(windows):
    """Band-pass filter and min-max scale each window to [0, 1]. Accepts shape (500,) or (n, 500)."""
    f = scipy.signal.filtfilt(_B, _A, windows, axis=-1)
    lo, hi = f.min(axis=-1, keepdims=True), f.max(axis=-1, keepdims=True)
    span = hi - lo
    return np.where(span > 0, (f - lo) / np.where(span > 0, span, 1), 0).astype(np.float32)


def burden_tier(burden):
    """Map AFib burden (fraction of time in AFib, 0-1) to the clinical tier 0-3."""
    if burden == 0:
        return 0
    if burden < 0.05:
        return 1
    if burden < 0.50:
        return 2
    return 3


class AFCNN_LSTM(nn.Module):
    """Per-window AFib detector: 2 s of ECG -> logits for [non-AFib, AFib]."""

    def __init__(self, num_classes=2):
        super().__init__()

        # Spatial features (QRS shape, P-wave presence)
        self.cnn = nn.Sequential(
            nn.Conv1d(1, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2),

            nn.Conv1d(64, 128, kernel_size=5, stride=2, padding=2),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2)
        )

        # Rhythm: beat-to-beat irregularity across the window
        self.lstm = nn.LSTM(input_size=128, hidden_size=64, num_layers=1, batch_first=True)
        self.dropout = nn.Dropout(p=0.3)
        self.fc = nn.Linear(64, num_classes)

    def forward(self, x):
        # x: [batch, 1, 500]
        out = self.cnn(x)              # [batch, 128, seq]
        out = out.permute(0, 2, 1)     # LSTM wants [batch, seq, features]
        _, (hn, _) = self.lstm(out)
        return self.fc(self.dropout(hn[-1]))


def afib_probabilities(model, signal, device='cpu'):
    """Split a raw 250 Hz signal into consecutive 2 s windows and return P(AFib) for each window."""
    n = len(signal) // WINDOW
    x = preprocess(np.asarray(signal[:n * WINDOW], dtype=np.float64).reshape(n, WINDOW))
    with torch.no_grad():
        logits = model(torch.from_numpy(x).unsqueeze(1).to(device))
    return torch.softmax(logits, dim=1)[:, 1].cpu().numpy()


# Post-processing chosen on validation patients (lowest burden error); see README "Results"
THRESHOLD = 0.6   # P(AFib) needed for a window to count
SMOOTH = 5        # median filter over 5 windows (10 s): drops lone false positives, fills lone misses
MIN_RUN = 10      # AFib must persist >= 10 windows (20 s) to count


def afib_windows(probs, threshold=THRESHOLD, smooth=SMOOTH, min_run=MIN_RUN):
    """
    Boolean AFib mask over consecutive windows. Recordings longer than min_run windows get median
    smoothing and the minimum-run rule; shorter strips (e.g. a 10 s upload) are only thresholded,
    since a 5-window filter would collapse a 5-window strip into a single vote.
    """
    probs = np.asarray(probs)
    if len(probs) <= min_run:
        return probs >= threshold
    hit = scipy.ndimage.median_filter(probs, size=smooth, mode='nearest') >= threshold
    runs, _ = scipy.ndimage.label(hit)
    return hit & (np.bincount(runs)[runs] >= min_run)  # label 0 is background, already False in hit


def compute_grad_cam(model: nn.Module, x: torch.Tensor, class_idx: int):
    """
    1D Grad-CAM on the last Conv1d layer for one window x of shape [1, 1, L].
    Returns L floats in [0, 1] marking which samples drove the class_idx decision.
    """
    target_layer = model.cnn[4]
    length = x.shape[-1]
    activations, gradients = [], []

    h1 = target_layer.register_forward_hook(lambda m, i, o: activations.append(o.detach()))
    h2 = target_layer.register_full_backward_hook(lambda m, gi, go: gradients.append(go[0].detach()))

    # cuDNN/MIOpen only support LSTM backward in train mode; restore afterwards
    lstm_was_training = model.lstm.training
    model.lstm.train()

    try:
        with torch.enable_grad():
            logits = model(x.clone().detach())
            model.zero_grad()
            logits[0, class_idx].backward()

        if not activations or not gradients:
            return [0.0] * length

        weights = gradients[0].mean(dim=2, keepdim=True)                      # [1, C, 1]
        cam = torch.clamp((weights * activations[0]).sum(dim=1, keepdim=True), min=0.0)
        cam = nn.functional.interpolate(cam, size=length, mode='linear', align_corners=False)
        cam = cam.squeeze().cpu().numpy()

        span = cam.max() - cam.min()
        cam = (cam - cam.min()) / span if span != 0 else np.zeros_like(cam)
        return cam.astype(float).tolist()
    finally:
        model.lstm.train(lstm_was_training)
        h1.remove()
        h2.remove()
