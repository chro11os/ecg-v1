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
At inference, the signal is cut into consecutive 2-second windows and each window gets P(AFib). `model.afib_windows` turns those into an AFib mask, and burden is the share of windows in AFib:

- a window needs P(AFib) ≥ 0.6
- a 5-window (10 s) median filter removes isolated false positives and fills isolated misses
- AFib must last at least 10 windows (20 s) to count, in the spirit of the clinical ≥ 30 s definition

These settings were chosen on validation patients. Strips of 10 windows or fewer, such as a 10-second upload, are only thresholded, because a 5-window filter would turn a 5-window strip into one vote. Burden then maps to a clinical tier (`model.burden_tier`):

| Tier | Burden |
|---|---|
| 0 · Sinus Rhythm | 0% |
| 1 · Micro-Burden / Rare Paroxysm | < 5% |
| 2 · Intermediate Burden / Active Paroxysm | 5% – 50% |
| 3 · High Burden / Persistent AFib | ≥ 50% |

A 10-second upload is 5 windows, so its burden moves in 20% steps and is a rough reading. Tier 1 is only reachable on longer recordings.

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

Trained on a 1,000-patient subset of Icentia11k (3,396 segments, 69 patients with AFib; see [Model pipeline](#model-pipeline)) on an AMD RX 6600. Every number below is on **test patients the model never saw**. Post-processing settings were chosen on the validation split; the test split was used only for these final numbers.

**Window level** (`evaluate_test_split.py`, 10,020 test windows, 1,097 AFib, natural prevalence):

| ROC-AUC | Sensitivity | Specificity | Precision | F1 |
|---|---|---|---|---|
| 0.932 | 77.2% | 90.3% | 49.4% | 0.602 |

**Record level:** the model slides over every 2 s of each ~70-minute test record (68 with AFib, 68 without), and measured burden is compared with the annotated burden.

| | Raw windows (P ≥ 0.5) | With post-processing |
|---|---|---|
| Tier accuracy | 43.4% | **80.9%** |
| Burden MAE | 13.9 pts | **12.4 pts** |

Tier confusion matrix with post-processing (rows = annotated tier, columns = predicted):

| | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **0** | 57 | 6 | 3 | 2 |
| **1** | 1 | 1 | 0 | 0 |
| **2** | 0 | 0 | 5 | 1 |
| **3** | 10 | 0 | 3 | 47 |

All 10 tier-3 records predicted as tier 0 come from a single test patient (`p00719`) whose AFib the model never recognises; it detects AFib for every other test patient. Tiers 1 and 2 have only 2 and 6 test records, so their numbers are anecdotal.

**Architecture comparison** (`comparison_models/benchmark.py`): every model is trained on the same windows with the same loss, epochs and best-validation checkpointing, and evaluated on the same test windows.

| Model | ROC-AUC | Sensitivity | Specificity | Precision | F1 |
|---|---|---|---|---|---|
| **1D CNN-LSTM (this model)** | 0.932 | 77.2% | 90.3% | 49.4% | 0.602 |
| CNN-BiLSTM | 0.915 | 80.7% | 86.9% | 43.0% | 0.561 |
| 1D CNN-GRU | 0.909 | 78.2% | 89.2% | 47.1% | 0.588 |
| Standalone 1D CNN | 0.864 | 46.5% | 95.0% | 53.3% | 0.497 |
| Standalone LSTM | 0.578 | 100.0% | 0.0% | 10.9% | 0.197 |
| Lightweight Transformer | 0.542 | 71.6% | 38.8% | 12.6% | 0.214 |

The three CNN + recurrent hybrids sit within 0.025 AUC of each other. That comes from a single training run each, so treat the ranking between them as indicative rather than settled. The convolutional front-end is what matters: the standalone LSTM on raw samples never learns (it predicts AFib for every window), and the small Transformer barely beats chance. ROC curves: `comparison_models/roc_curves.png`.

### What changed from v1
The thesis version (`thesis-v1`) reported a CNN-LSTM macro ROC-AUC of 0.6901 and recall of 42.55%; most baselines were near or below chance (Table 4.1). The paper attributes the missed tier-3 cases to "the clinical limitation of short 2.0-second snapshots" (§4). The underlying cause:

- Each record was labelled with its burden tier, computed over the full ~70-minute segment, but the model saw only the **first 2 seconds**. In most records with AFib, those 2 seconds are normal rhythm. One example: `p00139_s08`'s first AFib episode starts 38 minutes in. Most labels therefore couldn't be predicted from the input.
- Tiers 1 and 2 had only 3 and 4 records in total. Oversampling copied them hundreds of times, and the test set held 1 and 2 of them.
- The split was by file, not by patient, so segments from one patient could land in both train and test.

v2 labels each window from its own annotations, splits by patient, and measures burden instead of classifying it directly.

### Known limitations
- **Few AFib patients.** Training saw 51 AFib patients (validation 10, test 8), so AFib that looks unlike theirs can be missed entirely (see `p00719` above). Downloading more patients (`--patients`) is the most direct fix.
- **Tier 0 is strict.** It requires zero AFib windows after post-processing, so a single sustained false-positive run moves a sinus recording to tier 1. Post-processing reduced this from 64 of 68 sinus test records to 11.
- A 2-second window holds only 2–3 beats, which limits how much R-R irregularity the model can see.
- Atrial flutter and other rhythms count as non-AFib.

---

## Workstation features
- **Upload, simulate or load a sample:** drop a 10-second strip (2,500 samples at 250 Hz), record a synthetic one with the simulator, or load one of three real strips from test patients with one click.
- **ECG strip on calibrated paper:** 1 mm and 5 mm grid at 25 mm/s and 10 mm/mV, with a calibration pulse, the time between beats in ms above each beat, and 25 or 50 mm/s paper speed.
- **Rhythm track:** under the strip, each 2-second window shows the model's AFib probability and whether it counted toward burden. A second track shows Grad-CAM, where the model looked.
- **Result:** measured burden on a 0–100% scale marked with the tier boundaries, tier, model confidence, heart rate and R-R variability.
- **CHA₂DS₂-VASc** stroke risk score, with a per-criterion breakdown for registered patients.
- **Patient registry and scan history** (SQLite), with each patient's burden plotted across scans. A patient's *scans with AFib* figure is the share of their scans in which AFib was detected. Scans made before v2 have no measured burden and show only their tier.

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

Dataset: [Icentia11k](https://physionet.org/content/icentia11k-continuous-ecg/1.0/) (single-lead, 250 Hz, ~1.1 TB in full). `download_subset.py` fetches a training subset from PhysioNet's public AWS mirror, no account needed: annotations for every segment of the first 1,000 patients, plus signals for up to 10 AFib segments per AFib patient and 3 segments per other patient. That's about 9 GB, around 20 minutes on a 70 Mbit/s line, and safe to re-run. Records go to `ml_pipeline/physionet_data_aws/` (gitignored).

```bash
python ml_pipeline/download_subset.py         # ~9 GB training subset (--patients N for more)
python ml_pipeline/build_metadata_cache.py    # parse AFib episodes from every .atr (multicore)
python ml_pipeline/train.py                   # train, saves afib_cnn_lstm_v1.pt at the repo root
python ml_pipeline/evaluate_test_split.py     # window + record-level test metrics
python ml_pipeline/export_real_samples.py     # 10 s demo strips from test patients -> test/real_{sinus,paroxysm,afib}.json

python comparison_models/train_comparison.py  # baselines
python comparison_models/benchmark.py         # comparison table + ROC curves
python test/test_postprocess.py               # self-check for the burden post-processing
```

On AMD GPUs that ROCm doesn't officially support (like the RX 6600, gfx1032), set `HSA_OVERRIDE_GFX_VERSION=10.3.0` before running.

The backend loads `afib_cnn_lstm_v1.pt` from the repo root.
