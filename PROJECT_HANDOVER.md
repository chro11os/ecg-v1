# Project State Handover: ECG AFib Severity Classifier

This document serves as the project state memory file. If the AI agent is reset or a new session is started, reading this file will restore full context and state.

---

## 🎯 Project Overview & Objectives
* **Goal**: Automate Atrial Fibrillation (AF) severity classification in patients diagnosed with AF using continuous 1D ECG voltage signals.
* **Target Classes**: 4 severity levels (0 = Normal, 1 = Mild AF, 2 = Moderate AF, 3 = Severe AF) based on the computed **AF Burden** (percentage of time spent in AFib from annotations).
* **Dataset**: PhysioNet Icentia11k ECG database (continuous single-lead ECG strips @ 250Hz). Currently using subsets `p00` and `p01` (totaling **18,058 files** / ~36GB).

---

## 🔬 Scientific Methodology & System Architecture

### 1. Digital Signal Preprocessing (DSP) Pipeline
* **Denoising**: A 4th-order Butterworth bandpass filter with a passband of **`0.5 Hz - 45 Hz`** is applied using zero-phase filtering (`scipy.signal.filtfilt`) to remove baseline wander and powerline noise without shifting peak landmarks.
* **Normalization**: Signals are scaled segment-wise to the range **`[0.0, 1.0]`** via Min-Max normalization to eliminate patient-specific voltage amplitude differences.
* **Segmentation**: Continuous strips are segmented into **2-second windows** (exactly **500 samples** @ 250Hz).

### 2. Neural Network Architecture (1D CNN-LSTM)
* **Spatial Feature Extractor (1D CNN)**:
  * **Conv1D Layer 1**: 64 filters, kernel size 7, stride 2, padding 3 $\rightarrow$ BatchNorm $\rightarrow$ ReLU $\rightarrow$ MaxPool1d (kernel=2, stride=2).
  * **Conv1D Layer 2**: 128 filters, kernel size 5, stride 2, padding 2 $\rightarrow$ BatchNorm $\rightarrow$ ReLU $\rightarrow$ MaxPool1d (kernel=2, stride=2).
* **Temporal Rhythm Tracker (LSTM)**:
  * Reshapes CNN outputs to `[Batch, Sequence_Length, Features]` (31 sequence steps, 128 features).
  * Processes features using a single-layer LSTM with **64 hidden units** to track sequential timing fluctuations (R-R interval irregularities).
* **Regularization**:
  * A **0.3 Dropout layer** is applied to the final LSTM hidden state to prevent node co-dependency and guard against training set overfitting.
* **Classification Head**:
  * A Linear fully-connected layer maps the 64 hidden units to the 4 severity classes.

---

## 🚀 Current Status & Progress

### 1. Backup Completed
* The original Mac-optimized prototype is safely backed up in [ml_pipeline_mac_backup/](file:///home/chrollos/Documents/ecg-v1/ml_pipeline_mac_backup/).

### 2. Workstation Training Optimizations (Linux PC)
* **Hardware Acceleration**: Configured for **AMD Radeon RX 6600** via PyTorch ROCm (`cuda` device name).
* **CPU Multiprocessing**: Configured the PyTorch `DataLoader` with `num_workers=4`, `pin_memory=True`, and `persistent_workers=True` to eliminate disk I/O bottle-necks on the **Ryzen 7 5700X CPU**.
* **Label Caching**: Implemented an in-memory dictionary cache in the dataset class so continuous `.atr` annotations are parsed only once in the first epoch, boosting subsequent epoch iterations.

### 3. Model Training Status
* **Dataset Size**: Trained on both `p00` and `p01` (18,058 files).
* **Training Time**: ~3.5 minutes for 3 epochs.
* **Validation Performance**: **96.05% Accuracy** achieved on the final evaluation test split.
* **Weights Distribution**: Weights saved to `afib_cnn_lstm_v1.pt` and synchronized to:
  * Root folder: [/afib_cnn_lstm_v1.pt](file:///home/chrollos/Documents/ecg-v1/afib_cnn_lstm_v1.pt)
  * Training folder: [/ml_pipeline/afib_cnn_lstm_v1.pt](file:///home/chrollos/Documents/ecg-v1/ml_pipeline/afib_cnn_lstm_v1.pt)
  * Backend API folder: [/fast_api_backend/afib_cnn_lstm_v1.pt](file:///home/chrollos/Documents/ecg-v1/fast_api_backend/afib_cnn_lstm_v1.pt)

### 4. API Backend & Frontend Sync
* **FastAPI Server (`fast_api_backend/server.py`)**:
  * Re-engineered to support both **500 sample (2s)** and **2500 sample (10s)** input payloads for backward compatibility.
  * Dynamically detects acceleration hardware: runs CUDA on Linux PC, MPS on macOS (for Apple Silicon GPU), or CPU fallback, returning active hardware in JSON responses.
  * Preprocesses incoming request signals on the fly using the matching bandpass filter and normalization DSP pipeline.
  * Performs peak detection (R-peaks), RMSSD, and RR-variance calculation for frontend charts.
* **Git Configurations**:
  * Updated `.gitignore` to ignore the 36GB raw dataset (`physionet_data_aws/` globally) and backup folders (`/ml_pipeline_mac_backup/`), while explicitly **tracking** the 368KB trained `.pt` weights files.
* **macOS Setup File**:
  * Created [requirements-mac.txt](file:///home/chrollos/Documents/ecg-v1/requirements-mac.txt) to allow plug-and-play package installations on macOS during presentations.

---

## 📋 Next Steps (Remaining Roadmap)

When resuming development, execute these steps to implement the remaining items from the project roadmap:

### 1. Explainable AI (1D Grad-CAM Integration)
* **Goal**: Make model classification decisions transparent to clinicians.
* **Tasks**:
  1. Write a Grad-CAM feature hook in PyTorch targeting the output of the final Conv1D layer (Layer 2) inside `model.py` or as a utility class.
  2. Compute gradients of the winning class prediction score with respect to the feature map activations, and perform average pooling to get the 1D activation array.
  3. Interpolate the 1D activations to scale back to the original 500-sample resolution, mapping them to `[0, 1]`.

### 2. API Payload Expansion
* **Tasks**:
  1. Update `/predict` inside `server.py` to calculate the Grad-CAM activation array.
  2. Add the Grad-CAM values (a list of 500 float numbers) to the returned JSON payload (e.g., `"grad_cam": [...]`).

### 3. Frontend Visual Highlight
* **Tasks**:
  1. Update `frontend/src/components/WaveformChart.tsx`.
  2. Overlay a heatmap/gradient color strip onto the chart representing the Grad-CAM activation values, highlighting exactly which parts of the 2-second ECG waveform (e.g. erratic baseline, missing P-wave, irregular peaks) triggered the severity diagnosis.
