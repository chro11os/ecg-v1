import os
import sys
import json
import torch
import numpy as np
import scipy.signal as sig
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from starlette.middleware.cors import CORSMiddleware

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from model import AFCNN_LSTM, compute_grad_cam

try:
    from fast_api_backend.database import get_db_connection
except ImportError:
    from database import get_db_connection

app = FastAPI(title="ECG Atrial Fibrillation API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
weights_path = os.path.join(BASE_DIR, "afib_cnn_lstm_v1.pt")

# Crossplatform hardware acceleration (CUDA/ROCm -> Apple Silicon MPS -> CPU)
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

# Pydantic models
class PatientCreate(BaseModel):
    id: Optional[str] = None
    name: str
    age: int
    gender: str
    hypertension: int = 0
    diabetes: int = 0
    stroke_history: int = 0
    vascular_disease: int = 0
    heart_failure: int = 0

class ECGPayload(BaseModel):
    signal: List[float]
    patient_id: Optional[str] = None

# Unique patient ID generator format: #XXXX-X
def generate_unique_patient_id(conn) -> str:
    import random
    import string
    cursor = conn.cursor()
    while True:
        num = random.randint(1000, 9999)
        let = random.choice(string.ascii_uppercase)
        candidate = f"#{num}-{let}"
        cursor.execute("SELECT 1 FROM patients WHERE id = ?", (candidate,))
        if not cursor.fetchone():
            return candidate

# CHA₂DS₂-VASc rule engine
def compute_cha2ds2_vasc(age: int, gender: str, hypertension: int, diabetes: int, stroke_history: int, vascular_disease: int, heart_failure: int) -> int:
    score = 0
    if heart_failure:
        score += 1
    if hypertension:
        score += 1
    if age >= 75:
        score += 2
    elif 65 <= age <= 74:
        score += 1
    if diabetes:
        score += 1
    if stroke_history:
        score += 2
    if vascular_disease:
        score += 1
    if gender.lower() in ("f", "female"):
        score += 1
    return score

@app.post("/patients")
async def create_patient(patient: PatientCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        patient_id = patient.id
        if not patient_id:
            patient_id = generate_unique_patient_id(conn)
            
        cursor.execute("""
            INSERT OR REPLACE INTO patients (id, name, age, gender, hypertension, diabetes, stroke_history, vascular_disease, heart_failure)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            patient_id, patient.name, patient.age, patient.gender,
            patient.hypertension, patient.diabetes, patient.stroke_history,
            patient.vascular_disease, patient.heart_failure
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return {"status": "success", "message": f"Patient {patient_id} registered/updated successfully.", "patient_id": patient_id}

@app.get("/patients/next-id")
async def get_next_id():
    conn = get_db_connection()
    try:
        next_id = generate_unique_patient_id(conn)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return {"next_id": next_id}

@app.get("/patients")
async def list_patients():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM patients")
        rows = cursor.fetchall()
        patients_list = []
        for row in rows:
            p = dict(row)
            # Compute score
            p["stroke_risk_score"] = compute_cha2ds2_vasc(
                p["age"], p["gender"], p["hypertension"], p["diabetes"],
                p["stroke_history"], p["vascular_disease"], p["heart_failure"]
            )
            
            # Compute cumulative AFib burden
            cursor.execute("SELECT predicted_class FROM scans WHERE patient_id = ?", (p["id"],))
            scans = cursor.fetchall()
            total_scans = len(scans)
            if total_scans > 0:
                afib_scans = sum(1 for s in scans if s["predicted_class"] > 0)
                p["cumulative_burden"] = round((afib_scans / total_scans) * 100.0, 2)
            else:
                p["cumulative_burden"] = 0.0
                
            patients_list.append(p)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return patients_list

@app.get("/patients/{patient_id}/history")
async def get_patient_history(patient_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if patient exists
        cursor.execute("SELECT 1 FROM patients WHERE id = ?", (patient_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Patient not found")
            
        cursor.execute("SELECT * FROM scans WHERE patient_id = ? ORDER BY timestamp DESC", (patient_id,))
        rows = cursor.fetchall()
        history = []
        for row in rows:
            scan = dict(row)
            if scan["signal_data"]:
                scan["signal_data"] = json.loads(scan["signal_data"])
            if scan["r_peaks"]:
                scan["r_peaks"] = json.loads(scan["r_peaks"])
            if scan["grad_cam"]:
                scan["grad_cam"] = json.loads(scan["grad_cam"])
            history.append(scan)
    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return history

@app.post("/predict")
async def predict_ecg(payload: ECGPayload):
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

        # 6. Traditional DSP landmark peak detection and interval gating on the full uploaded signal
        filtered_signal_full = sig.filtfilt(b, a, raw_signal)
        max_val_filtered = np.max(filtered_signal_full)
        r_peaks, _ = sig.find_peaks(filtered_signal_full, distance=100, height=max_val_filtered * 0.45)
        r_peaks_list = r_peaks.tolist()

        if len(r_peaks_list) > 1:
            rr_intervals_ms = np.diff(r_peaks) * 4.0
            rr_variance = float(np.var(rr_intervals_ms))
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

        # 7. Database storage and cumulative analytics
        stroke_risk_score = 0
        cumulative_burden = 0.0

        if payload.patient_id:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                # Check if patient exists
                cursor.execute("SELECT * FROM patients WHERE id = ?", (payload.patient_id,))
                p_row = cursor.fetchone()
                if p_row:
                    p = dict(p_row)
                    stroke_risk_score = compute_cha2ds2_vasc(
                        p["age"], p["gender"], p["hypertension"], p["diabetes"],
                        p["stroke_history"], p["vascular_disease"], p["heart_failure"]
                    )
                    
                    # Record the scan
                    cursor.execute("""
                        INSERT INTO scans (patient_id, signal_data, predicted_class, confidence, rr_variance, rmssd, r_peaks, grad_cam)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        payload.patient_id,
                        json.dumps(payload.signal),
                        severity_class,
                        confidence,
                        rr_variance,
                        rmssd,
                        json.dumps(r_peaks_list),
                        json.dumps(grad_cam_values)
                    ))
                    conn.commit()

                    # Re-calculate cumulative burden
                    cursor.execute("SELECT predicted_class FROM scans WHERE patient_id = ?", (payload.patient_id,))
                    scans = cursor.fetchall()
                    total_scans = len(scans)
                    if total_scans > 0:
                        afib_scans = sum(1 for s in scans if s["predicted_class"] > 0)
                        cumulative_burden = round((afib_scans / total_scans) * 100.0, 2)
            except Exception as db_err:
                print(f"Error during database operations in predict: {db_err}")
            finally:
                conn.close()

        return {
            "severity_class": severity_class,
            "confidence": round(confidence, 4),
            "hardware_used": hardware,
            "r_peaks": r_peaks_list,
            "rr_variance": round(rr_variance, 2),
            "rmssd": round(rmssd, 2),
            "grad_cam": grad_cam_values,
            "stroke_risk_score": stroke_risk_score,
            "cumulative_burden": cumulative_burden
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
