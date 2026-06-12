import torch
import torch.nn as nn


class AFCNN_LSTM(nn.Module):
    def __init__(self, num_classes=4.0):
        super(AFCNN_LSTM, self).__init__()

        # 1. Spatial Feature Extraction (The CNN)
        # Primary convolutional layer scaled to 64 filters as per thesis specifications
        self.cnn = nn.Sequential(
            nn.Conv1d(in_channels=int(1.0), out_channels=int(64.0), kernel_size=int(7.0), stride=int(2.0),
                      padding=int(3.0)),
            nn.BatchNorm1d(int(64.0)),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=int(2.0), stride=int(2.0)),

            nn.Conv1d(in_channels=int(64.0), out_channels=int(128.0), kernel_size=int(5.0), stride=int(2.0),
                      padding=int(2.0)),
            nn.BatchNorm1d(int(128.0)),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=int(2.0), stride=int(2.0))
        )

        # 2. Temporal Tracking (The LSTM)
        # Process 128-channel spatial features over sequence length
        self.lstm = nn.LSTM(input_size=int(128.0), hidden_size=int(64.0), num_layers=int(1.0), batch_first=True)

        # Regularization layer: Dropout (0.3) to prevent training set overfitting
        self.dropout = nn.Dropout(p=0.3)

        # 3. The Classification Head
        self.fc = nn.Linear(int(64.0), int(num_classes))

    def forward(self, x):
        # Input 'x' shape: [Batch_Size, 1.0, 500.0] (2.0 seconds at 250.0 Hz)

        # Extract features (P-wave, QRS complex shapes)
        out = self.cnn(x)

        # CRITICAL DIMENSION SWAP
        # CNN outputs: [Batch_Size, Features, Sequence_Length]
        # LSTM requires: [Batch_Size, Sequence_Length, Features]
        out = out.permute(0, 2, 1)

        # Track the heartbeat rhythm over time
        lstm_out, (hn, cn) = self.lstm(out)

        # Extract only the final conclusion of the LSTM at the end of the 2.0 seconds
        final_state = hn[-1]

        # Apply dropout regularization prior to dense classification layer
        final_state = self.dropout(final_state)

        # Output the 4.0 severity predictions (0.0, 1.0, 2.0, 3.0)
        logits = self.fc(final_state)

        return logits


def compute_grad_cam(model: nn.Module, x: torch.Tensor, class_idx: int):
    """
    Computes 1D Grad-CAM for the AFCNN_LSTM model.
    Highlights which parts of the 500-sample ECG signal contributed to the classification of class_idx.
    Returns:
        list: 500-sample activation heatmap scaled to [0.0, 1.0] as a list of floats.
    """
    import numpy as np

    # Target the last Conv1D layer
    target_layer = model.cnn[4]

    activations = []
    gradients = []

    def forward_hook(module, input, output):
        activations.append(output.detach())

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0].detach())

    h1 = target_layer.register_forward_hook(forward_hook)
    h2 = target_layer.register_full_backward_hook(backward_hook)

    # Track LSTM training state to restore it later (critical for ROCm/MIOpen compatibility)
    lstm_was_training = model.lstm.training
    model.lstm.train()

    try:
        # Run forward pass with gradients enabled
        with torch.enable_grad():
            # Clone and ensure requires_grad on input
            input_tensor = x.clone().detach()
            # Forward pass
            logits = model(input_tensor)
            score = logits[0, class_idx]

            # Backward pass
            model.zero_grad()
            score.backward()

        if len(activations) == 0 or len(gradients) == 0:
            return [0.0] * 500

        act = activations[0]
        grad = gradients[0]

        # Channel weights (GAP of gradients)
        weights = torch.mean(grad, dim=2, keepdim=True)  # [1, Channels, 1]

        # Weighted combination of activation maps
        grad_cam = torch.sum(weights * act, dim=1, keepdim=True)  # [1, 1, Length]

        # Apply ReLU to only keep positive contributions
        grad_cam = torch.clamp(grad_cam, min=0.0)

        # Interpolate/resize back to 500 samples
        grad_cam_resized = nn.functional.interpolate(
            grad_cam,
            size=500,
            mode='linear',
            align_corners=False
        )

        grad_cam_array = grad_cam_resized.squeeze().cpu().numpy()

        # Min-max normalization to [0.0, 1.0]
        min_val = grad_cam_array.min()
        max_val = grad_cam_array.max()
        denom = max_val - min_val
        if denom != 0:
            grad_cam_norm = (grad_cam_array - min_val) / denom
        else:
            grad_cam_norm = np.zeros_like(grad_cam_array)

        return grad_cam_norm.astype(float).tolist()
    finally:
        # Restore LSTM training state
        model.lstm.train(lstm_was_training)
        # Ensure hooks are always removed
        h1.remove()
        h2.remove()