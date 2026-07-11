# Clinical ECG Atrial Fibrillation Classification System

This system uses a hybrid 1D CNN-LSTM model to classify the severity of Atrial Fibrillation (AFib) from single-channel ECG waveforms. It includes an API server and a visual frontend dashboard.

---

## 1. System Overview & Data Flow

```
Raw ECG Signal (10s) ──> Bandpass Filter (0.5-45 Hz) ──> Min-Max Scaling [0, 1] ──> Window Slicing (2s)
                                                                                        │
Visual Heatmap Overlay <── 1D Grad-CAM Map <── CNN-LSTM Inference & Classification <────┘
```

1. **Input:** The user uploads a 10-second JSON ECG voltage array (2,500 samples at 250 Hz).
2. **Preprocessing:** The server filters, normalizes, and slices the first 2 seconds (500 samples) of the signal.
3. **Model Inference:** The 1D CNN-LSTM model classifies the signal.
4. **Grad-CAM Calculation:** The model backpropagates gradients to calculate a 1D activation map (500 values) showing where it focused.
5. **Output:** The API returns the predicted severity, confidence, R-peak indices, RMSSD, R-R variance, and the Grad-CAM activation array.
6. **Visualization:** The GUI displays the waveform, peak annotations, metrics, and overlays the Grad-CAM values as a heatmap.

---

## 2. Codebase Structure

* **`ml_pipeline/`**: Training and validation code.
  * `dataset.py`: Data loading and annotation classification from PhysioNet.
  * `build_metadata_cache.py`: Multiprocessing script to index local files.
  * `train_balanced.py`: Prepares stratified splits, balances classes, and trains the model.
  * `evaluate_test_split.py`: Validates model weights against the test split.
  * `export_perfect_demo_samples.py`: Extracts verified patient recordings for GUI testing.
* **`backend/`**: REST API backend.
  * `server.py`: Runs uvicorn web server, performs signal preprocessing, runs model inference, and calculates Grad-CAM.
  * `afib_cnn_lstm_v1.pt`: Trained model weights dictionary.
* **`frontend/`**: React/TypeScript dashboard.
  * `src/components/WaveformChart.tsx`: Renders ECG waveforms and overlays Grad-CAM heatmaps.
  * `src/components/DiagnosisDashboard.tsx`: Displays metrics, gauge charts, and class info.
* **`comparison_models/`**: Benchmark directory.
  * `models.py`: Code for 5 comparative models (CNN, LSTM, CNN-GRU, CNN-BiLSTM, Transformer).
  * `train_comparison.py`: Training script for baseline models.
  * `benchmark.py`: Comparative evaluator printing tables and plotting ROC curves.

---

## 3. Specifications

### Signal Preprocessing
* **Filter:** 4th-order Butterworth bandpass filter ($0.5\text{ Hz} - 45\text{ Hz}$).
* **Normalization:** Amplitudes scaled to $[0.0, 1.0]$ via Min-Max scaling.
* **Inference Window:** 2.0 seconds (500 samples at 250 Hz).

### Model Architecture (1D CNN-LSTM)
* **CNN Front-End:**
  * Conv1D: 1 input channel, 64 output channels, kernel size 7, stride 2, padding 3. BatchNorm1d, ReLU, MaxPool1d (kernel 2, stride 2).
  * Conv1D: 64 input channels, 128 output channels, kernel size 5, stride 2, padding 2. BatchNorm1d, ReLU, MaxPool1d (kernel 2, stride 2).
* **Rhythm Tracker (LSTM):**
  * Reshapes CNN output to `[Batch, 31, 128]` (31 steps, 128 features).
  * 1-layer LSTM with 64 hidden units.
* **Regularization & Head:**
  * 0.3 Dropout applied to the final hidden state of the LSTM.
  * Dense linear layer mapping 64 hidden units to 4 severity output classes.

### Severity Class Rules (Based on AFib Burden)
* **Class 0 (Normal):** 0.0% AFib burden
* **Class 1 (Trace):** < 5.0% AFib burden
* **Class 2 (Mild):** < 50.0% AFib burden
* **Class 3 (Severe):** >= 50.0% AFib burden

---

## 4. How to Run the System

### Dependencies Setup
Install python dependencies:
```bash
pip install -r requirements.txt
```
Install frontend dependencies:
```bash
cd frontend && npm install
```

### Run the Application (Dashboard & Server)
1. **Start the API Server (Root Directory):**
   ```bash
   uvicorn backend.server:app --port 8000 --host 0.0.0.0
   ```
2. **Start the Frontend Client (`frontend/` Directory):**
   ```bash
   npm run dev
   ```
3. **Upload Demo Files:** Drag and drop `test/real_normal.json`, `test/real_trace.json`, `test/real_mild.json`, or `test/real_severe.json` to verify predictions and Grad-CAM overlays.

### Rebuild and Train Model
1. **Build Metadata Cache:** `python ml_pipeline/build_metadata_cache.py`
2. **Train Model:** `python ml_pipeline/train_balanced.py`
3. **Evaluate Test Split:** `python ml_pipeline/evaluate_test_split.py`

### Run Benchmarks
1. **Generate Splits:** `python comparison_models/prepare_splits.py`
2. **Train Comparative Models:** `python comparison_models/train_comparison.py`
3. **Run Benchmark:** `python comparison_models/benchmark.py`
   * *Generates:* Console comparison table, `comparison_models/roc_curves.png`, and `comparison_models/benchmark_results.json`.
