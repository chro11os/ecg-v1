import json
import numpy as np
from fastapi import APIRouter, HTTPException
from backend.app.models.schemas import ECGPayload
from backend.app.services.dsp import apply_min_max_normalization, apply_bandpass_filter, extract_ecg_landmarks
from backend.app.services.inference import run_model_inference, get_hardware_info
from backend.app.database import get_db_connection
from backend.app.routers.patients import compute_cha2ds2_vasc

router = APIRouter(tags=["prediction"])

@router.post("/predict")
async def predict_ecg(payload: ECGPayload):
    n_samples = len(payload.signal)
    if n_samples not in (500, 2500):
        raise HTTPException(status_code=400, detail="Payload must be exactly 500 or 2500 samples")

    try:
        # 1. Convert to numpy array
        raw_signal = np.array(payload.signal, dtype=np.float32)

        # 2. Slice to 500 samples (2.0 seconds @ 250Hz) for model inference
        inference_signal = raw_signal[:500]

        # 3 & 4. Filter and Normalize
        filtered_inference = apply_bandpass_filter(inference_signal, fs=250.0)
        normalized_inference = apply_min_max_normalization(filtered_inference)

        # 5. Model Inference
        severity_class, confidence, grad_cam_values = run_model_inference(normalized_inference)

        # 6. Traditional DSP landmark peak detection and interval gating on the full uploaded signal
        r_peaks_list, rr_variance, rmssd = extract_ecg_landmarks(raw_signal, fs=250.0)

        hardware = get_hardware_info()

        # 7. Database storage and cumulative analytics
        stroke_risk_score = 0
        cumulative_burden = 0.0
        scan_id = None
        patient_id_to_use = payload.patient_id or "#0000-0"

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # Check if patient exists
            cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id_to_use,))
            p_row = cursor.fetchone()
            
            # If patient is anonymous and profile doesn't exist, create it
            if not p_row and patient_id_to_use == "#0000-0":
                cursor.execute("""
                    INSERT INTO patients (id, name, age, gender, hypertension, diabetes, stroke_history, vascular_disease, heart_failure)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, ("#0000-0", "Anonymous Scan Profile", 65, "male", 0, 0, 0, 0, 0))
                conn.commit()
                cursor.execute("SELECT * FROM patients WHERE id = ?", ("#0000-0",))
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
                    patient_id_to_use,
                    json.dumps(payload.signal),
                    severity_class,
                    confidence,
                    rr_variance,
                    rmssd,
                    json.dumps(r_peaks_list),
                    json.dumps(grad_cam_values)
                ))
                conn.commit()
                scan_id = cursor.lastrowid

                # Re-calculate cumulative burden
                cursor.execute("SELECT predicted_class FROM scans WHERE patient_id = ?", (patient_id_to_use,))
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
            "cumulative_burden": cumulative_burden,
            "scan_id": scan_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
