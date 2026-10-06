# GTT - AFib Detection & Assessment Tool

Detects Atrial Fibrillation (AFib) in single-lead ECG and measures **AFib burden**, the share of time a patient spends in AFib. A 1D CNN-LSTM classifies every 2-second window as AFib or non-AFib, and burden is measured by sliding it across the recording. A FastAPI + SQLite backend and a React workstation add Grad-CAM explanations, HRV metrics, an ECG simulator and CHA₂DS₂-VASc stroke-risk scoring.

> Research prototype. Not a medical device and not validated for clinical use.

## Paper

**[Classification of Atrial Fibrillation Burden Tiers in ECG Signals Using Hybrid 1D CNN-LSTM Models](thesis.pdf)**
Guzman, N. B., Tambagan, E. A. D., Tolentino, A. J. B. III. Thesis, School of Information Technology, Mapúa Institute of Technology, July 2026. Adviser: Joel C. De Goma.

The paper's results come from the original pipeline, preserved at git tag [`thesis-v1`](../../tree/thesis-v1). The code on `main` has since been revised (see [What changed from v1](#what-changed-from-v1)), so it does not reproduce the paper's numbers.

---

## How it works

### 1. Labels come from the window the model sees
Icentia11k annotates rhythm episodes inside each ~70-minute segment (`(AFIB` … `)`). `ml_pipeline/dataset.py` parses those episodes. A 2-second window is labelled **AFib** when at least half of it lies inside an annotated AFib episode, so every label describes exactly the signal the model receives.

### 2. Burden is measured, then mapped to a tier
At inference, the signal is cut into consecutive 2-second windows. Each window gets P(AFib), and burden is the share of windows with P ≥ 0.5. Burden then maps to a clinical tier (`model.burden_tier`):

| Tier | Burden |
|---|---|
| 0 · Sinus Rhythm | 0% |
| 1 · Micro-Burden / Rare Paroxysm | < 5% |
| 2 · Intermediate Burden / Active Paroxysm | 5% – 50% |
| 3 · High Burden / Persistent AFib | ≥ 50% |

A 10-second upload is 5 windows, so its burden moves in 20% steps. Tier 1 is only reachable on longer recordings.

### 3. Preprocessing (`model.preprocess`, shared by training and the API)
1. 4th-order Butterworth band-pass, 0.5–45 Hz (zero-phase `filtfilt`)
2. Min-max scaling of each window to [0, 1]

### 4. Model (`model.py`)
Conv1d(64, k7) → Conv1d(128, k5), each with BatchNorm, ReLU and MaxPool → LSTM(64) → Dropout(0.3) → Linear(2). Grad-CAM on the last conv layer gives a per-sample heatmap for each window.

### 5. Training (`ml_pipeline/train.py`)
- **Patient-wise 70/15/15 split.** Icentia segments from the same patient never cross splits.
- **Train windows:** 10 random windows per segment, plus 10 drawn from inside AFib episodes to offset AFib's low prevalence. Class-weighted cross-entropy.
- **Val/test windows:** 20 random windows per segment, natural prevalence.
- Adam (lr 1e-3), 10 epochs. Keeps the checkpoint with the best validation ROC-AUC.

---

## Results

_To be filled in after retraining on the full dataset:_ `python ml_pipeline/evaluate_test_split.py` reports
- **window level:** ROC-AUC, sensitivity, specificity, precision, F1 on held-out test patients
- **record level:** burden MAE and tier accuracy / confusion matrix, from sliding the model over every 2 s of each test record

`python comparison_models/benchmark.py` compares the CNN-LSTM against a standalone CNN, standalone LSTM, CNN-GRU, CNN-BiLSTM and a small Transformer, all trained the same way on the same windows. It writes `benchmark_results.json` and `roc_curves.png`.

### What changed from v1
The thesis version (`thesis-v1`) reported a CNN-LSTM macro ROC-AUC of 0.6901 and recall of 42.55%; most baselines were near or below chance (Table 4.1). The paper attributes the missed tier-3 cases to "the clinical limitation of short 2.0-second snapshots" (§4). The underlying cause:

- Each record was labelled with its burden tier, computed over the full ~70-minute segment, but the model saw only the **first 2 seconds**. In most records with AFib, those 2 seconds are normal rhythm. One example: `p00139_s08`'s first AFib episode starts 38 minutes in. Most labels therefore couldn't be predicted from the input.
- Tiers 1 and 2 had only 3 and 4 records in total. Oversampling copied them hundreds of times, and the test set held 1 and 2 of them.
- The split was by file, not by patient, so segments from one patient could land in both train and test.

v2 labels each window from its own annotations, splits by patient, and measures burden instead of classifying it directly.

### Known limitations
- **Tier boundaries are sensitive to false positives.** Tier 0 requires zero AFib windows, so even a 1% window false-positive rate pushes most long sinus recordings into tier 1. Natural next steps: require a minimum episode length (AFib is clinically defined as lasting ≥ 30 s), or tune the window threshold on validation data.
- A 2-second window holds only 2–3 beats, which limits how much R-R irregularity the model can see.
- Atrial flutter and other rhythms count as non-AFib.

---

## Workstation features
- **Upload or simulate** a 10 s Lead I strip (2,500 samples @ 250 Hz). The simulator generates sinus or AFib rhythms with heart-monitor audio.
- **Diagnosis dashboard:** tier, measured burden, confidence, per-window AFib probabilities, a Grad-CAM heatmap over the full strip, R-peaks, R-R variance and RMSSD.
- **CHA₂DS₂-VASc** stroke-risk score from patient demographics and comorbidities.
- **Patient registry and scan history** (SQLite). A patient's *cumulative burden* is the share of their scans in which AFib was detected.

### API
`POST /predict` with `{"signal": [... 500 or 2500 floats ...], "patient_id": "optional"}` returns `severity_class` (tier), `afib_burden` (%), `window_afib_probs`, `confidence`, `grad_cam`, `r_peaks`, `rr_variance`, `rmssd`, `stroke_risk_score`, `cumulative_burden`, `scan_id`. It returns `503` until trained weights exist.

---

## Setup

### Backend (Python 3.10+)
```bash
pip install -r requirements.txt        # Linux + AMD ROCm
pip install -r requirements-mac.txt    # macOS (MPS)
```

### Frontend
```bash
cd frontend && bun install   # or npm install
```

### Run
```bash
./start.sh
```
This starts the backend on `:8000` and the Vite dev server, then prints both URLs. To run them separately: `uvicorn backend.server:app --port 8000` and `cd frontend && bun run dev`.

---

## Model pipeline

Dataset: [Icentia11k](https://physionet.org/content/icentia11k-continuous-ecg/1.0/) (single-lead, 250 Hz). Place records under `ml_pipeline/physionet_data_aws/p0*/pXXXXX/` (gitignored).

```bash
python ml_pipeline/build_metadata_cache.py    # parse AFib episodes from every .atr (multicore)
python ml_pipeline/train.py                   # train, saves afib_cnn_lstm_v1.pt at the repo root
python ml_pipeline/evaluate_test_split.py     # window + record-level test metrics
python ml_pipeline/export_real_samples.py     # 10 s demo strips from test patients -> test/real_{sinus,paroxysm,afib}.json

python comparison_models/train_comparison.py  # baselines
python comparison_models/benchmark.py         # comparison table + ROC curves
```

The backend loads `afib_cnn_lstm_v1.pt` from the repo root.
