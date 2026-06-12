# ECG Atrial Fibrillation Severity Classifier (Version 2)

This project classifies the severity of Atrial Fibrillation (AFib) in patients using 1D electrocardiogram (ECG) voltage signals. It includes a deep learning model, a web API backend, and an interactive frontend dashboard with model explainability (heatmaps).

---

## 📊 Core Project Facts

### 1. Goal & Classes
The system classifies ECG recordings into one of four severity levels based on the patient's **AFib Burden** (the percentage of time spent in AFib):
* **Class 0 (Normal):** 0.0% AFib burden
* **Class 1 (Trace):** Less than 5.0% AFib burden
* **Class 2 (Mild):** Between 5.0% and 50.0% AFib burden
* **Class 3 (Severe):** Greater than 50.0% AFib burden

### 2. Dataset
* **Source:** PhysioNet Icentia11k ECG database (single-lead ECG recorded at 250 Hz).
* **Local Size:** 21,033 patient files (including subsets `p00`, `p01`, and `p02`).
* **Distribution:** 95.38% Normal (Class 0), 0.01% Trace (Class 1), 0.02% Mild (Class 2), and 4.59% Severe (Class 3).

### 3. Signal Processing
Before inference, raw ECG inputs go through the following steps:
1. **Bandpass Filter:** A 4th-order Butterworth filter ($0.5\text{ Hz} - 45\text{ Hz}$) removes breathing movement drift and high-frequency noise.
2. **Normalization:** Voltage amplitudes are scaled between `0.0` and `1.0`.
3. **Segmentation:** Signals are sliced into 2-second windows (exactly 500 samples).

### 4. Model Architecture (1D CNN-LSTM)
* **Spatial Layer (CNN):** Extracts shape features (QRS complexes, wave slopes) using two 1D Conv layers (64 and 128 filters).
* **Rhythm Layer (LSTM):** Tracks time interval fluctuations between beats using 64 hidden units.
* **Regularization:** A 0.3 Dropout layer prevents overfitting.
* **Classifier:** A final linear layer maps features to the 4 severity classes.
* **Explainability (Grad-CAM):** Computes gradients from the final Conv1d layer to identify which parts of the 2-second waveform triggered the model's decision, returning a 500-value heatmap.

### 5. Training & Evaluation
* **Addressing Imbalance:** Because 95% of the data is normal, the model was trained on a balanced set of **4,000 files (1,000 per class)** using random oversampling (duplicating minority files) and undersampling.
* **Performance:** Evaluated on an unseen 15% testing split (3,159 records), the balanced model achieves **63.91% Accuracy** and correctly identifies **40.4% of all Severe AFib cases** (40.4% Recall).

---

## 🛠️ Installation & Setup

### 📦 Backend Dependencies (Python)
Make sure you have python 3.10+ installed. Install the required libraries in your environment:
```bash
pip install -r requirements.txt
```
*Key Packages:* `torch` (PyTorch), `fastapi` (API), `uvicorn` (Server), `scipy` (Filters/Peak detection), `wfdb` (PhysioNet file reader), `scikit-learn` (Metrics), `matplotlib` (Plotting).

### 📦 Frontend Dependencies (Node.js)
Navigate to the `frontend/` folder and install packages:
```bash
cd frontend
npm install
```
*Key Packages:* `react`, `chart.js` & `react-chartjs-2` (Waveform plotting), `chartjs-plugin-zoom` (ECG panning/zooming), `react-dropzone` (File drag-and-drop).

---

## 🚀 How to Run the Project

### 1. Run the Interactive GUI & API (Default Workflow)

#### Start the Backend Server:
From the project root directory, run:
```bash
uvicorn fast_api_backend.server:app --port 8000 --host 0.0.0.0
```
This starts the FastAPI server. It will load the trained weights file (`afib_cnn_lstm_v1.pt`) and automatically run on your GPU if ROCm (AMD) or MPS (Apple Silicon) is available, falling back to CPU if not.

#### Start the Frontend App:
In a new terminal window, navigate to the `frontend/` folder and start the dev server:
```bash
cd frontend
npm run dev
```
Open your browser and navigate to the local address shown (typically `http://localhost:5173`).

#### Demo Files:
To test the interface, drag and drop the verified clinical patient files located in the `test/` directory:
* `real_normal.json` (Expected: Class 0 - Normal)
* `real_trace.json` (Expected: Class 1 - Trace)
* `real_mild.json` (Expected: Class 2 - Mild)
* `real_severe.json` (Expected: Class 3 - Severe)

---

### 2. Train and Validate Our 1D CNN-LSTM Model (Ours)

If you need to rebuild the metadata cache or retrain the main thesis model:

#### Step A: Build the Metadata Cache (Multicore Scan)
Build the index of patient files and labels. This script runs in parallel across all CPU cores:
```bash
python ml_pipeline/build_metadata_cache.py
```

#### Step B: Train Our Model
Train the 1D CNN-LSTM architecture on the balanced 4,000-record dataset:
```bash
python ml_pipeline/train_balanced.py
```
This saves the weights to `afib_cnn_lstm_v1.pt` and synchronizes them to the root and backend folders.

#### Step C: Evaluate on the Test Split
Evaluate the model weights on the unseen 15% testing split (3,159 records):
```bash
python ml_pipeline/evaluate_test_split.py
```

---

### 3. Run comparative Benchmarks

To train the comparative baseline architectures and run the master evaluation:

#### Step A: Prepare Layout Splits
Generates and locks the Train/Val/Test split layout file:
```bash
python comparison_models/prepare_splits.py
```

#### Step B: Train all 5 Comparative Models
Trains the Standalone CNN, Standalone LSTM, CNN-GRU, CNN-BiLSTM, and Transformer baselines on the S3 dataset:
```bash
python comparison_models/train_comparison.py
```

#### Step C: Initiate the Benchmark
Loads all trained baselines along with our Thesis model, runs them on the testing split, and generates comparison data:
```bash
python comparison_models/benchmark.py
```
* **Outputs:** 
  * Prints the benchmarking comparison table in the console.
  * Saves plotted ROC curves to `comparison_models/roc_curves.png`.
  * Exports metrics and confusion matrices to `comparison_models/benchmark_results.json`.
