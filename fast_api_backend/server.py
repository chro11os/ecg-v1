import os
import sys
import torch
from fastapi import FastAPI, HTTPException
from numpy import dtype
from pydantic import BaseModel
from typing import List

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from model import AFCNN_LSTM

app = FastAPI(title="ECG Atrial Fibrillation API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
weights_path = os.path.join(BASE_DIR, "afib_cnn_lstm_v1.pt")

device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

model = AFCNN_LSTM(num_classes=4.0)
model.load_state_dict(torch.load(weights_path, map_location=device))
model.to(device)
model.eval()

class ECGPayload(BaseModel):
    signal: List[float]

@app.post("/predict")
async def predict_ecg(payload: ECGPayload):
    if len(payload.signal) !=2500:
        raise HTTPException(status_code=400, detail="Payload must be exactly 2500 samples")

    try:
        x = torch.tesor(payload.signal, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(x)
            probs = torch.softmax(logits, dim=1)
            conf, pred = torch.max(probs, dim=1)
        return {
            "severity_class": int(pred.item()),
            "confidence": float(conf.item()),
            "hardware_used": str(device)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
