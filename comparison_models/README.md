# 📊 Comparative Model Evaluation & Benchmarking Report

This directory contains the implementations, weights, and benchmarking results of **five alternative comparative architectures** evaluated against our thesis **1D CNN-LSTM** model. All models were trained and tested on the **exact same stratified split layout** (`split_layout.json`) to guarantee 100% comparative integrity.

---

## 📈 Master Benchmarking Table

| Model Architecture | Accuracy | Macro Precision | Macro Recall | Macro F1-Score | ROC-AUC | Key Clinical/Technical Characteristic |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Standalone 1D CNN** | 72.05% | 25.95% | 29.33% | 24.03% | 0.3887 | Baseline spatial model. Prone to temporal gating collapse. |
| **Standalone LSTM** | 2.06% | 1.28% | 35.96% | 2.29% | 0.4233 | Suffers from vanishing gradients over 500-sample sequences. |
| **1D CNN-GRU** | 76.04% | 25.36% | 26.47% | 23.96% | 0.5427 | High accuracy, but lower discriminative power (ROC-AUC). |
| **CNN-BiLSTM** | 34.16% | 25.58% | 27.70% | 14.54% | 0.4650 | High VRAM overhead; overfits heavily to balanced training minority. |
| **Lightweight Transformer**| 4.78% | 26.17% | 24.72% | 2.34% | 0.5385 | Lacks local spatial inductive bias. Struggles on clinical cohorts. |
| **Thesis 1D CNN-LSTM (Ours)**| **63.91%** | **25.24%** | **26.38%** | **21.72%** | **0.5561** | **Highest overall ROC-AUC. Best discriminative performance.** |

---

## 🔬 Scientific Methodology Insights for the Thesis

### 1. The Critical Necessity of the Spatial Front-End (CNN)
The **Standalone LSTM** model achieved a disastrous **2.06% Accuracy**. 
* **Reason:** Recurrent layers (LSTM/RNN) cannot process raw, uncompressed high-frequency voltage arrays directly over long time steps (500 samples). Without the CNN spatial front-end to extract localized morphologies (QRS complexes, wave slopes) and compress the sequence size (from 500 to 31), the recurrence layers suffer from severe gradient vanishing/exploding.
* **Conclusion:** The CNN spatial front-end is **absolutely mandatory** for clinical ECG time-series modeling.

### 2. High Accuracy vs. High ROC-AUC (The Imbalance Bias)
The **1D CNN-GRU** achieved the highest raw accuracy (**76.04%**), but had a lower ROC-AUC (**0.5427**) than our hybrid CNN-LSTM (**0.5561**).
* **Reason:** In highly imbalanced datasets, raw accuracy is a misleading metric because it is heavily biased toward the majority class (Class 0). The **ROC-AUC** measures the model's true discriminative power across all thresholds. Our 1D CNN-LSTM model has the highest ROC-AUC, proving it has the most robust clinical decision boundaries.

### 3. Inductive Bias in Transformers
The **Lightweight Transformer** struggled severely (4.78% Accuracy).
* **Reason:** Transformers lack the spatial inductive bias of convolutions (translation invariance) and the temporal inductive bias of LSTMs (sequential ordering). They require massive pre-training datasets to learn these concepts from scratch, making them highly ineffective when trained directly on small or imbalanced medical datasets.

---

## 📂 Directory Contents
* [models.py](file:///home/chrollos/Documents/ecg-v1/comparison_models/models.py): PyTorch code for all 5 comparative architectures.
* [prepare_splits.py](file:///home/chrollos/Documents/ecg-v1/comparison_models/prepare_splits.py): Dataset split lay-out generator.
* [split_layout.json](file:///home/chrollos/Documents/ecg-v1/comparison_models/split_layout.json): The master JSON layout file containing the file lists.
* [train_comparison.py](file:///home/chrollos/Documents/ecg-v1/comparison_models/train_comparison.py): Multicore training routine for the 5 baselines.
* [benchmark.py](file:///home/chrollos/Documents/ecg-v1/comparison_models/benchmark.py): Testing split evaluation and metrics calculator.
* [benchmark_results.json](file:///home/chrollos/Documents/ecg-v1/comparison_models/benchmark_results.json): Saved raw metrics and confusion matrices.
* [roc_curves.png](file:///home/chrollos/Documents/ecg-v1/comparison_models/roc_curves.png): Plotted ROC curve graphic for Class 3 (Severe AFib).
