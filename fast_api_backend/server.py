import os
import sys
import torch
import numpy as np
import scipy.signal as sig
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from starlette.middleware.cors import CORSMiddleware

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from model import AFCNN_LSTM, compute_grad_cam

app = FastAPI(title="ECG Atrial Fibrillation API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
weights_path = os.path.join(BASE_DIR, "afib_cnn_lstm_v1.pt")

# Cross-platform hardware acceleration (CUDA/ROCm -> Apple Silicon MPS -> CPU)
if torch.cuda.is_available():
    device = torch.device("cuda")
elif torch.backends.mps.is_available():
    device = torch.device("mps")
else:
    device = torch.device("cpu")

model = AFCNN_LSTM(num_classes=4)
try:
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path, map_location=device))
        print("Successfully loaded model weights.")
    else:
        print(f"Weights file not found at {weights_path}. Running with uninitialized weights.")
except Exception as e:
    print(f"WARNING: Could not load model weights ({e}). The server will start, but model inference will use uninitialized weights until retrained.")

model.to(device)
model.eval()

class ECGPayload(BaseModel):
    signal: List[float]

@app.post("/predict")
async def predict_ecg(payload: ECGPayload):
    # Support both 500 (2.0s) and 2500 (10.0s) sample payloads for backward compatibility
    n_samples = len(payload.signal)
    if n_samples not in (500, 2500):
        raise HTTPException(status_code=400, detail="Payload must be exactly 500 or 2500 samples")

    try:
        # 1. Convert to numpy array
        raw_signal = np.array(payload.signal, dtype=np.float32)

        # 2. Slice to 500 samples (2.0 seconds @ 250Hz) for model inference
        inference_signal = raw_signal[:500]

        # 3. Apply bandpass filter (0.5 Hz - 45 Hz)
        nyquist = 0.5 * 250.0
        low = 0.5 / nyquist
        high = 45.0 / nyquist
        b, a = sig.butter(4, [low, high], btype='band')
        filtered_signal = sig.filtfilt(b, a, inference_signal)

        # 4. Apply Min-Max normalization
        min_val = np.min(filtered_signal)
        max_val = np.max(filtered_signal)
        denom = max_val - min_val
        normalized_signal = (filtered_signal - min_val) / denom if denom != 0 else np.zeros_like(filtered_signal)

        # 5. Model Inference
        x = torch.tensor(normalized_signal, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(x)
            probs = torch.softmax(logits, dim=1)
            conf, pred = torch.max(probs, dim=1)

        severity_class = int(pred.item())
        confidence = float(conf.item())

        # Compute Grad-CAM explainability maps (500 values scaled [0, 1])
        grad_cam_values = compute_grad_cam(model, x, severity_class)

        # 6. Traditional DSP landmark peak detection and interval gating on the full uploaded signal (for frontend rendering)
        max_val_full = np.max(raw_signal)
        r_peaks, _ = sig.find_peaks(raw_signal, distance=100, height=max_val_full * 0.45)
        r_peaks_list = r_peaks.tolist()

        if len(r_peaks_list) > 1:
            # 250Hz sample rate means each sample step is 4ms
            rr_intervals_ms = np.diff(r_peaks) * 4.0
            rr_variance = float(np.var(rr_intervals_ms))
            
            # RMSSD (Root Mean Square of Successive Differences) in ms
            diff_rr = np.diff(rr_intervals_ms)
            rmssd = float(np.sqrt(np.mean(diff_rr ** 2))) if len(diff_rr) > 0 else 0.0
        else:
            rr_variance = 0.0
            rmssd = 0.0

        if device.type == "cuda":
            hardware = f"AMD ROCm GPU ({torch.cuda.get_device_name(0)})"
        elif device.type == "mps":
            hardware = "Apple Silicon GPU (MPS)"
        else:
            hardware = "CPU"

        return {
            "severity_class": severity_class,
            "confidence": round(confidence, 4),
            "hardware_used": hardware,
            "r_peaks": r_peaks_list,
            "rr_variance": round(rr_variance, 2),
            "rmssd": round(rmssd, 2),
            "grad_cam": grad_cam_values
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

