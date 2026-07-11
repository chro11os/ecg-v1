import os
import sys
import torch
import numpy as np

# Ensure root is in sys.path to import model.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))
from model import AFCNN_LSTM, compute_grad_cam
from backend.app.config import DEVICE, WEIGHTS_PATH

# Instantiate and load model
model = AFCNN_LSTM(num_classes=4)
try:
    if os.path.exists(WEIGHTS_PATH):
        model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
        print("Successfully loaded model weights.")
    else:
        print(f"Weights file not found at {WEIGHTS_PATH}. Running with uninitialized weights.")
except Exception as e:
    print(f"WARNING: Could not load model weights ({e}). Model inference will use uninitialized weights.")

model.to(DEVICE)
model.eval()

def run_model_inference(normalized_signal: np.ndarray) -> tuple[int, float, list[float]]:
    x = torch.tensor(normalized_signal, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)
        conf, pred = torch.max(probs, dim=1)

    severity_class = int(pred.item())
    confidence = float(conf.item())

    # Compute Grad-CAM explainability maps (500 values scaled [0, 1])
    grad_cam_values = compute_grad_cam(model, x, severity_class)

    return severity_class, confidence, grad_cam_values

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
