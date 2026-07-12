# GTT - AFib Detection & Assessment Tool

This project classifies the severity of Atrial Fibrillation (AFib) in patients using 1D electrocardiogram (ECG) voltage signals. It includes a deep learning model, an SQLite database-backed web API backend, and an interactive frontend workstation with model explainability (Grad-CAM heatmaps), real-time ECG simulation, and clinical CDSS risk assessments.

---

## Core Project Facts

### 1. Goal & Burden Tiers
The system classifies ECG recordings into one of four clinical **AFib Burden Tiers** based on the temporal ratio of active AFib segments in a 10s recording:
* **Sinus Rhythm (Tier 0):** 0.0% AFib burden.
* **Micro-Burden / Rare Paroxysm (Tier 1):** Less than 5.0% AFib burden.
* **Intermediate Burden / Active Paroxysm (Tier 2):** Between 5.0% and 50.0% AFib burden.
* **High Burden / Persistent AFib (Tier 3):** Greater than 50.0% AFib burden.

### 2. Dataset
* **Source:** PhysioNet Icentia11k ECG database (single-lead ECG recorded at 250 Hz).
* **Local Size:** 21,033 patient files (including subsets `p00`, `p01`, and `p02`).
* **Distribution:** 95.38% Normal, 0.01% Trace, 0.02% Mild, and 4.59% Severe.

### 3. Signal Processing
Before inference, raw ECG inputs go through the following steps:
1. **Bandpass Filter:** A 4th-order Butterworth filter ($0.5\text{ Hz} - 45\text{ Hz}$) removes breathing movement drift and high-frequency noise.
2. **Normalization:** Voltage amplitudes are scaled between `0.0` and `1.0`.
3. **Segmentation:** Signals are sliced into 2-second windows (exactly 500 samples).

### 4. Model Architecture (1D CNN-LSTM)
* **Spatial Layer (CNN):** Extracts shape features (QRS complexes, wave slopes) using two 1D Conv layers (64 and 128 filters).
* **Rhythm Layer (LSTM):** Tracks time interval fluctuations between beats using 64 hidden units.
* **Regularization:** A 0.3 Dropout layer prevents overfitting.
* **Classifier:** A final linear layer maps features to the 4 Burden Tiers.
* **Explainability (Grad-CAM):** Computes gradients from the final Conv1d layer to identify which parts of the 2-second waveform triggered the model's decision, returning a 500-value heatmap.

### 5. Training & Evaluation
* **Addressing Imbalance:** Because 95% of the data is normal, the model was trained on a balanced set of **4,000 files (1,000 per class)** using random oversampling and undersampling.
* **Performance:** Evaluated on an unseen 15% testing split (3,159 records), the balanced model achieves **63.91% Accuracy** and correctly identifies **40.4% of all Severe AFib cases** (40.4% Recall).

---

## Interactive Workstation Features

### 1. Bedside ECG Simulator
* Generates real-time Lead I ECG waveforms using dynamic R-R intervals and flat T-waves tailored to reflect authentic clinical Sinus Rhythm or Atrial Fibrillation.
* Includes heart monitor audio beep sound controls and flash indicators.

### 2. Simulated Demographics & CHA₂DS₂-VASc Form
* Enables testing stroke risk factors directly on the ECG Simulator using custom Age, Gender, and Comorbidities checklists (HF, Hypertension, Diabetes, Stroke, Vascular Disease).
* Automatically upserts simulation configurations to the anonymous clinical database profile.

### 3. Trust-Building Developer Log Console
* Simulates sequential DSP filtering, LSTM model forward passes, and XAI Grad-CAM gradient mapping inside a staggered terminal logging interface to build diagnostic trust ("Labor Illusion").

### 4. Split-Pane Registry Tabs
* Separates Patients list records (supporting creations, edits, and deletions) from the global Scans history, dividing persistent clinical records from temporary session simulations.

---

## Installation & Setup

### Backend Dependencies (Python)
Make sure you have python 3.10+ installed. Install the required libraries in your environment:
```bash
pip install -r requirements.txt
```
*Key Packages:* `torch` (PyTorch), `fastapi` (API), `uvicorn` (Server), `scipy` (Filters/Peak detection), `wfdb` (PhysioNet file reader), `scikit-learn` (Metrics), `matplotlib` (Plotting).

### Frontend Dependencies (Node.js)
Navigate to the `frontend/` folder and install packages:
```bash
cd frontend
npm install
```
*Key Packages:* `react`, `chart.js` & `react-chartjs-2` (Waveform plotting), `chartjs-plugin-zoom` (ECG panning/zooming), `react-dropzone` (File drag-and-drop).

---

## How to Run the Project

### The Single-Command Bootloader (Recommended)
You can start both the backend FastAPI server and the Vite dev server concurrently using the clinical bootloader script in the root directory:
```bash
./start.sh
```
This script handles building, port check bindings, and outputs color-coded direct localhost links in your terminal.

Alternatively, you can run them in separate terminals:

#### Start the Backend Server:
```bash
uvicorn backend.server:app --port 8000 --host 0.0.0.0
```
This starts the FastAPI server. It will load the trained weights file (`afib_cnn_lstm_v1.pt`) and automatically run on your GPU if available, falling back to CPU if not.

#### Start the Frontend App:
In a new terminal window, navigate to the `frontend/` folder and start the dev server:
```bash
cd frontend
npm run dev
```

---

## Model Pipeline & Benchmarks

If you need to rebuild the metadata cache or retrain the main thesis model:

### 1. Build the Metadata Cache (Multicore Scan)
Build the index of patient files and labels. This script runs in parallel across all CPU cores:
```bash
python ml_pipeline/build_metadata_cache.py
```

### 2. Train Our Model
Train the 1D CNN-LSTM architecture on the balanced 4,000-record dataset:
```bash
python ml_pipeline/train_balanced.py
```
This saves the weights to `afib_cnn_lstm_v1.pt` and synchronizes them to the root and backend folders.

### 3. Run Comparative Benchmarks
To train the comparative baseline architectures and run the master evaluation:
```bash
python comparison_models/prepare_splits.py
python comparison_models/train_comparison.py
python comparison_models/benchmark.py
```
* **Outputs:** 
  * Prints the benchmarking comparison table in the console.
  * Saves plotted ROC curves to `comparison_models/roc_curves.png`.
  * Exports metrics and confusion matrices to `comparison_models/benchmark_results.json`.
