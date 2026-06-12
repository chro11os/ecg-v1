# Implementation Checklist: Thesis Specifications vs. Current Codebase

This checklist identifies the gaps between your current implementation and the specifications in the thesis paper: **"Classification of ECG Signal Severity in Patients Diagnosed with Atrial Fibrillation Using 1D CNN-LSTM Models"**.

---

## 📊 Summary of Architectural & Pipeline Gaps

| Feature / Parameter | Specification in Paper | Current Codebase | Status |
| :--- | :--- | :--- | :--- |
| **Window Length** | **2.0 seconds** (500 samples) | 10.0 seconds (2500 samples) | ❌ Gap |
| **Band-pass Filter** | Enabled (Butterworth / DSP) | Raw signal directly | ❌ Gap |
| **Normalization** | Min-Max Normalization (`[0, 1]`) | None | ❌ Gap |
| **CNN Primary Filters** | **64 filters** | 16 filters | ❌ Gap |
| **Model Regularization** | **Dropout (0.3)** before output | None | ❌ Gap |
| **Dataset Splits** | **70% / 15% / 15%** (Train/Val/Test) | 80% / 20% (Train/Val) | ❌ Gap |
| **Batch Size** | **64** | 32 | ❌ Gap |
| **Metrics Pipeline** | Precision, Recall, F1, ROC-AUC, Confusion Matrix | Accuracy & Loss only | ❌ Gap |
| **Explainable AI (XAI)** | **1D Grad-CAM** / Feature importance | None | ❌ Gap |

---

## 🛠️ Implementation Checklist

### 1. Signal Preprocessing & Loader Updates
* [x] **Band-pass Filtering:** 
  * Add a Butterworth band-pass filter using `scipy.signal` inside [dataset.py](file:///home/chrollos/Documents/ecg-v1/ml_pipeline/dataset.py) (e.g., passband 0.5 Hz to 45 Hz) to eliminate baseline wander and high-frequency noise.
* [x] **2-Second Window Segmentation:**
  * Update `window_size` in the loader to `500` samples (2 seconds @ 250 Hz) instead of `2500`.
* [x] **Min-Max Normalization:**
  * Implement segment-wise normalization scaling signal amplitudes between `0.0` and `1.0`.
 
### 2. Model Architecture Re-engineering ([model.py](file:///home/chrollos/Documents/ecg-v1/model.py))
* [x] **Input Dimension Shift:**
  * Adjust comments and forward shape assertions to handle `[Batch, 1, 500]` tensors.
* [x] **CNN Density Scaling:**
  * Increase primary Conv1D filter size from `16` to `64`.
* [x] **Regularization (Dropout):**
  * Insert a `nn.Dropout(p=0.3)` layer between the LSTM hidden state extraction and the final fully-connected (`Linear`) head.
 
### 3. Training & Hyperparameters ([main.py](file:///home/chrollos/Documents/ecg-v1/ml_pipeline/main.py))
* [x] **Partitioning Splits:**
  * Redesign splits to partition data into strict 70% training, 15% validation, and 15% test bins.
* [x] **Batch Size Adjustment:**
  * Change `DataLoader` batch sizes to `64`.
* [x] **Optimizer Parameters:**
  * Verify Adam is initialized at learning rate `0.001` (currently matches).
 
### 4. Evaluation & Metrics Pipeline
* [x] **Multi-Metric Tracker:**
  * Update training/validation summaries to track F1-Score, Precision, and Recall (Sensitivity).
* [x] **ROC-AUC & Confusion Matrix:**
  * Write a test evaluation function utilizing `scikit-learn` to calculate overall class ROC-AUC scores and render a Confusion Matrix.


### 5. Explainable AI (Grad-CAM Integration)
* [x] **1D Grad-CAM Extractor:**
  * Write a Grad-CAM hook in PyTorch to compute gradients from the last Conv1D layer with respect to class predictions. This highlights exactly which parts of the 2-second ECG wave triggered the classification.
* [x] **API Payload Expansion:**
  * Update the `/predict` response in [server.py](file:///home/chrollos/Documents/ecg-v1/fast_api_backend/server.py) to return the calculated Grad-CAM activation array (500 values scaled `[0, 1]`) alongside the diagnosis.

### 6. GUI and API Sync
* [x] **API Validation Updates:**
  * Change [server.py](file:///home/chrollos/Documents/ecg-v1/fast_api_backend/server.py) payload verification limit from `2500` to `500` samples.
* [x] **Frontend Chart Highlight:**
  * Update the frontend [WaveformChart.tsx](file:///home/chrollos/Documents/ecg-v1/frontend/src/components/WaveformChart.tsx) to overlay a heat-map color gradient representing the Grad-CAM activation values, making the model decisions explainable.
