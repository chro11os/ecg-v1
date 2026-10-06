import os
import sys

import numpy as np
import torch

# Ensure root is in sys.path to import model.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))
from model import WINDOW, AFCNN_LSTM, afib_probabilities, afib_windows, burden_tier, compute_grad_cam, preprocess
from backend.app.config import DEVICE, WEIGHTS_PATH

model = AFCNN_LSTM()
model_loaded = False
try:
    model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE, weights_only=True))
    model_loaded = True
    print("Successfully loaded model weights.")
except Exception as e:
    print(f"WARNING: Could not load model weights from {WEIGHTS_PATH} ({e}). /predict is disabled until "
          "the model is trained with ml_pipeline/train.py.")

model.to(DEVICE)
model.eval()


def run_model_inference(raw_signal: np.ndarray) -> tuple[int, float, float, list[float], list[float]]:
    """
    Classify every 2 s window of the signal as AFib / non-AFib (model.afib_windows post-processing)
    and measure burden from those windows.
    Returns (tier, confidence, burden %, per-window P(AFib), Grad-CAM over the whole signal).
    """
    probs = afib_probabilities(model, raw_signal, DEVICE)
    is_afib = afib_windows(probs)
    burden = float(is_afib.mean())
    confidence = float(np.where(probs >= 0.5, probs, 1 - probs).mean())

    # Grad-CAM per window for the class it was assigned, concatenated to match the signal length
    windows = preprocess(np.asarray(raw_signal, dtype=np.float64).reshape(-1, WINDOW))
    grad_cam = []
    for window, afib in zip(windows, is_afib):
        x = torch.from_numpy(window).reshape(1, 1, -1).to(DEVICE)
        grad_cam += compute_grad_cam(model, x, int(afib))

    return burden_tier(burden), confidence, round(100.0 * burden, 2), [round(float(p), 4) for p in probs], grad_cam


def get_hardware_info() -> str:
    if DEVICE.type == "cuda":
        try:
            return f"AMD ROCm GPU ({torch.cuda.get_device_name(0)})"
        except Exception:
            return "GPU (CUDA)"
    elif DEVICE.type == "mps":
        return "Apple Silicon GPU (MPS)"
    else:
        return "CPU"
