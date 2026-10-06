import os
import random
import sys

import numpy as np
import torch
import wfdb
from sklearn.metrics import confusion_matrix

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_pipeline.dataset import load_cache, patient_split
from ml_pipeline.train import DEVICE, WEIGHTS_PATH, evaluate, loader, window_datasets
from model import AFCNN_LSTM, afib_probabilities, burden_tier


def evaluate_burden(model, test_records, seed=0):
    """
    Slide the model over every 2 s of each test record and compare the measured AFib burden with the
    annotated one. Uses every test record containing AFib plus an equal number of AFib-free records.
    """
    with_afib = sorted(p for p, m in test_records.items() if m['afib'])
    without = sorted(p for p, m in test_records.items() if not m['afib'])
    paths = with_afib + random.Random(seed).sample(without, min(len(with_afib), len(without)))
    print(f"\nRecord-level burden on {len(paths)} test records ({len(with_afib)} with AFib)...")

    true_b, pred_b = [], []
    for path in paths:
        meta = test_records[path]
        probs = afib_probabilities(model, wfdb.rdrecord(path).p_signal[:, 0], DEVICE)
        pred_b.append(float((probs >= 0.5).mean()))
        true_b.append(sum(e - s for s, e in meta['afib']) / meta['sig_len'])

    true_b, pred_b = np.array(true_b), np.array(pred_b)
    true_t = [burden_tier(b) for b in true_b]
    pred_t = [burden_tier(b) for b in pred_b]
    print(f"Burden MAE: {100 * np.abs(true_b - pred_b).mean():.2f} percentage points")
    print(f"Tier accuracy: {100 * np.mean(np.array(true_t) == np.array(pred_t)):.2f}%")
    print("Tier confusion matrix (rows = annotated tier 0-3, cols = predicted):")
    print(confusion_matrix(true_t, pred_t, labels=[0, 1, 2, 3]))


if __name__ == '__main__':
    model = AFCNN_LSTM().to(DEVICE)
    model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE, weights_only=True))

    _, _, test_set = window_datasets()
    evaluate(model, loader(test_set), "test windows")
    evaluate_burden(model, patient_split(load_cache())['test'])
