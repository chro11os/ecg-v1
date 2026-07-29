import json
import numpy as np
from pydantic import BaseModel
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

class ContinuousPayload(BaseModel):
    patient_id: str
    mode: str  # 'real_online' or 'synthetic_simulation'

def parse_afib_episodes_from_atr(annotation, fs=250.0):
    sample_indices = annotation.sample
    symbols = annotation.symbol
    aux_notes = annotation.aux_note
    total_samples = sample_indices[-1] if len(sample_indices) > 0 else 0
    if total_samples == 0:
        return 0.0, 0.0

    total_af_samples = 0
    longest_af_samples = 0
    in_afib = False
    afib_start_idx = 0

    for i, symbol in enumerate(symbols):
        note = aux_notes[i] if i < len(aux_notes) else ""
        if "(AFIB" in note and not in_afib:
            in_afib = True
            afib_start_idx = sample_indices[i]
        elif ("(N" in note or "(SVTA" in note or "(AFL" in note) and in_afib:
            in_afib = False
            dur = sample_indices[i] - afib_start_idx
            total_af_samples += dur
            if dur > longest_af_samples:
                longest_af_samples = dur

    if in_afib:
        dur = total_samples - afib_start_idx
        total_af_samples += dur
        if dur > longest_af_samples:
            longest_af_samples = dur

    afib_burden = (total_af_samples / total_samples) * 100.0
    longest_episode_hours = longest_af_samples / (fs * 3600.0)
    return afib_burden, longest_episode_hours

def generate_synthetic_wave(predicted_class: int, n_samples=2500, fs=250.0):
    t = np.linspace(0, n_samples / fs, n_samples, endpoint=False)
    # Baseline noise + sinusoidal respiration modulation
    signal = 0.05 * np.sin(2 * np.pi * 0.15 * t) + 0.01 * np.random.normal(size=n_samples)
    
    # Generate R-peak pulses based on rhythm class
    r_peaks = []
    if predicted_class == 0:  # Sinus Rhythm (Regular ~70 bpm)
        rr_mean = int(fs * 0.85)  # 850 ms interval
        curr = int(fs * 0.4)
        while curr < n_samples:
            r_peaks.append(curr)
            curr += rr_mean + int(np.random.normal(0, fs * 0.02))
    else:  # AFib (Irregular RR interval)
        curr = int(fs * 0.3)
        while curr < n_samples:
            r_peaks.append(curr)
            # Highly variable RR interval
            rr_val = int(fs * np.random.uniform(0.4, 1.3))
            curr += rr_val

    # Construct simple ECG pulses on R-peaks
    for p in r_peaks:
        # QRS complex approximation
        for i in range(-10, 11):
            idx = p + i
            if 0 <= idx < n_samples:
                val = 1.0 - (abs(i) / 10.0)
                if i == 0:
                    val = 1.0
                elif i < 0:
                    val = -0.1 if i == -5 else val * 0.8
                else:
                    val = -0.15 if i == 5 else val * 0.7
                signal[idx] += val * 0.9

        # P-wave (absent in AFib)
        if predicted_class == 0:
            p_offset = -35
            for i in range(-12, 13):
                idx = p + p_offset + i
                if 0 <= idx < n_samples:
                    signal[idx] += 0.12 * np.exp(-((i / 5.0) ** 2))

        # T-wave
        t_offset = 60
        for i in range(-25, 26):
            idx = p + t_offset + i
            if 0 <= idx < n_samples:
                signal[idx] += 0.22 * np.exp(-((i / 10.0) ** 2))

    return signal.tolist()

@router.post("/predict/continuous")
async def predict_continuous_ecg(payload: ContinuousPayload):
    import urllib.request
    import tempfile
    import wfdb
    import random

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM patients WHERE id = ?", (payload.patient_id,))
    p_row = cursor.fetchone()
    if not p_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Patient profile not found")

    p = dict(p_row)
    conn.close()

    classification = "Sinus Rhythm"
    duration_hours = 0.0
    afib_burden = 0.0
    rr_variance = 0.0
    rmssd = 0.0
    conf = 0.95
    signal_segment = []
    r_peaks_list = []
    grad_cam_values = []

    try:
        if payload.mode == "real_online":
            # Direct download of a random segment from one of the first 10 patients
            # (Ensures fast download speed and variety)
            patient_num = random.randint(0, 9)
            segment_num = random.randint(0, 4)
            record_name = f"p{patient_num:05d}_s{segment_num:02d}"
            subdir = f"p00/p{patient_num:05d}"
            base_url = f"https://physionet.org/files/icentia11k-continuous-ecg/1.0/{subdir}/{record_name}"

            with tempfile.TemporaryDirectory() as temp_dir:
                # Download WFDB files
                for ext in [".hea", ".dat", ".atr"]:
                    url = f"{base_url}{ext}"
                    local_path = os.path.join(temp_dir, f"{record_name}{ext}")
                    urllib.request.urlretrieve(url, local_path)

                # Parse files
                record_path = os.path.join(temp_dir, record_name)
                record = wfdb.rdrecord(record_path)
                annotation = wfdb.rdann(record_path, "atr")

                # Extract first 2500 samples (10 seconds) for frontend waveform preview
                raw_signal = record.p_signal[:2500, 0].astype(np.float32)
                signal_segment = raw_signal.tolist()

                # Slice to 500 samples (2s) for deep learning model inference
                inference_signal = raw_signal[:500]
                filtered_inference = apply_bandpass_filter(inference_signal, fs=250.0)
                normalized_inference = apply_min_max_normalization(filtered_inference)

                # Deep classification & Grad-CAM highlight
                severity_class, conf, grad_cam_values = run_model_inference(normalized_inference)

                # Extract R-peaks and HRV metrics on the 10s preview signal
                r_peaks_list, rr_variance, rmssd = extract_ecg_landmarks(raw_signal, fs=250.0)

                # Parse the full 70-minute annotation to compute burden and longest AFib episode
                afib_burden, longest_episode_hours = parse_afib_episodes_from_atr(annotation, fs=250.0)
                duration_hours = len(record.p_signal) / (250.0 * 3600.0)

                # Determine continuous classification
                if afib_burden == 0.0:
                    classification = "Sinus Rhythm"
                elif longest_episode_hours < (7 * 24.0):
                    classification = "Paroxysmal"
                elif longest_episode_hours < (365 * 24.0):
                    classification = "Persistent"
                else:
                    classification = "Long-standing Persistent"

        else:  # synthetic_simulation
            # Influence simulation outcomes using patient comorbidities (Hypertension, Diabetes, Obesity)
            comorbidity_count = p["hypertension"] + p["diabetes"] + p["obesity"]
            
            # Base probability of AFib depends on comorbidity profile
            afib_probability = 0.15 + (comorbidity_count * 0.25)  # Range [0.15, 0.90]
            is_afib = random.random() < afib_probability

            if not is_afib:
                classification = "Sinus Rhythm"
                duration_hours = 24.0
                afib_burden = 0.0
                severity_class = 0
            else:
                # Comorbidities dictate severity and continuous duration tier
                if comorbidity_count == 3:  # Severe patient profile
                    classification = "Long-standing Persistent"
                    duration_hours = random.uniform(9000, 12000)  # >1 year
                    afib_burden = random.uniform(70.0, 99.0)
                    severity_class = 3
                elif comorbidity_count >= 1:  # Mild-moderate patient profile
                    classification = "Persistent"
                    duration_hours = random.uniform(200, 500)  # >7 days
                    afib_burden = random.uniform(25.0, 70.0)
                    severity_class = 2
                else:
                    classification = "Paroxysmal"
                    duration_hours = random.uniform(2, 48)  # <7 days
                    afib_burden = random.uniform(2.0, 20.0)
                    severity_class = 1

            # Generate synthetic signal matching the predicted class
            signal_segment = generate_synthetic_wave(severity_class, n_samples=2500, fs=250.0)
            
            # Process & infer to compute model metrics
            inference_signal = np.array(signal_segment[:500], dtype=np.float32)
            filtered_inference = apply_bandpass_filter(inference_signal, fs=250.0)
            normalized_inference = apply_min_max_normalization(filtered_inference)

            _, conf, grad_cam_values = run_model_inference(normalized_inference)
            r_peaks_list, rr_variance, rmssd = extract_ecg_landmarks(np.array(signal_segment, dtype=np.float32), fs=250.0)

        # 3. Store the session and scan snapshot in the database
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO monitoring_sessions (patient_id, type, classification, total_duration_hours)
                VALUES (?, ?, ?, ?)
            """, (payload.patient_id, payload.mode, classification, round(duration_hours, 2)))
            session_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO scans (patient_id, signal_data, predicted_class, confidence, rr_variance, rmssd, r_peaks, grad_cam)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                payload.patient_id,
                json.dumps(signal_segment),
                severity_class if payload.mode == "real_online" else severity_class,
                conf,
                rr_variance,
                rmssd,
                json.dumps(r_peaks_list),
                json.dumps(grad_cam_values)
            ))
            conn.commit()
        finally:
            conn.close()

        return {
            "status": "success",
            "session_id": session_id,
            "patient_id": payload.patient_id,
            "type": payload.mode,
            "classification": classification,
            "total_duration_hours": round(duration_hours, 2),
            "afib_burden": round(afib_burden, 2),
            "rr_variance": round(rr_variance, 2),
            "rmssd": round(rmssd, 2),
            "confidence": round(conf, 4),
            "r_peaks": r_peaks_list,
            "grad_cam": grad_cam_values,
            "signal": signal_segment
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Continuous prediction failure: {str(e)}")

