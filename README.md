# GTT - AFib Detection & Assessment Tool

This project classifies Atrial Fibrillation (AFib) burden in patients using 1D electrocardiogram (ECG) voltage signals. It includes a 1D CNN-LSTM deep learning model, an SQLite database-backed FastAPI backend, and an interactive workstation featuring model explainability (Grad-CAM heatmaps), HRV metrics (RMSSD, R-R variance), longitudinal burden tracking, and clinical CDSS risk assessments (CHA₂DS₂-VASc).

---

## Core Project Facts

### 1. AFib Burden Tiers
The system classifies ECG recordings into four clinical **AFib Burden Tiers** based on the temporal ratio of active AFib segments in a 10s recording:
* **Sinus Rhythm (Tier 0):** 0.0% AFib burden.
* **Micro-Burden / Rare Paroxysm (Tier 1):** Less than 5.0% AFib burden.
* **Intermediate Burden / Active Paroxysm (Tier 2):** 5.0% to 50.0% AFib burden.
* **High Burden / Persistent AFib (Tier 3):** Greater than 50.0% AFib burden.

### 2. Clinical CDSS & Longitudinal Tracking
* **Temporal Ratio Burden:** Computes the percentage of 2-second windows showing active AFib within a scan.
* **Longitudinal Cumulative Burden:** Tracks historical patient scan trends over time.
* **CHA₂DS₂-VASc Assessment:** Calculates stroke risk score based on demographic and comorbidity profiles (Congestive Heart Failure, Hypertension, Age, Diabetes, Stroke/TIA history, Vascular Disease, Sex).

### 3. Database Schema & Patient IDs
* **Database:** SQLite (`backend/ecg_records.db`).
* **Candidate IDs:** Clinical IDs generated via backend (`GET /patients/next-id`) using format `#XXXX-X`.
* **Tables:** 
  * `patients`: Stores patient demographics and comorbidity flags.
  * `scans`: Stores prediction metadata (`signal_data`, `predicted_class`, `confidence`, `rr_variance`, `rmssd`, `r_peaks`, `grad_cam`, `timestamp`).

### 4. Signal Processing & HRV Metrics
1. **Bandpass Filter:** 4th-order Butterworth filter ($0.5\text{ Hz} - 45\text{ Hz}$) to remove baseline wander and noise.
2. **Normalization:** Voltage amplitudes scaled between `0.0` and `1.0`.
3. **Segmentation:** Signals sliced into 2-second windows (500 samples each).
4. **HRV Analysis:** Computes R-peak locations, R-R variance, and Root Mean Square of Successive Differences (RMSSD).

### 5. Model Architecture & XAI (1D CNN-LSTM)
* **Spatial Layer (CNN):** 2x 1D Conv layers (64 & 128 filters) extracting QRS wave shapes and slopes.
* **Temporal Layer (LSTM):** 64 hidden units modeling beat-to-beat interval dynamics.
* **Explainability (Grad-CAM):** Gradient-weighted Class Activation Mapping generating a 500-point heatmap for wave segments.

---

## Interactive Workstation Features

* **Split-Pane Navigation:** Patient registry sidebar for patient context switching, registration, and targeting.
* **Targeted Scan Workspace:** Targeted patient dropzone for uploading raw 1D ECG signals.
* **Diagnostic Dashboard:** Full-width view with Grad-CAM wave charts, HRV stats, CHA₂DS₂-VASc card, and longitudinal trend lines.
* **Bedside ECG Simulator:** Real-time synthetic Lead I ECG simulator with heart monitor audio feedback and dynamic demographic risk forms.

---

## Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js 18+

### Single-Command Bootloader
```bash
./start.sh
```

### Manual Execution

#### Backend Server (FastAPI)
```bash
pip install -r requirements.txt
uvicorn backend.server:app --port 8000 --host 0.0.0.0
```

#### Frontend Workstation (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## Model Pipeline & Benchmarks

```bash
# Build metadata cache
python ml_pipeline/build_metadata_cache.py

# Train 1D CNN-LSTM model
python ml_pipeline/train_balanced.py

# Run comparison models & benchmarks
python comparison_models/prepare_splits.py
python comparison_models/train_comparison.py
python comparison_models/benchmark.py
```
