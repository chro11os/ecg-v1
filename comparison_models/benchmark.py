import json
import os
import sys

import matplotlib.pyplot as plt
import torch
from sklearn.metrics import roc_curve

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from comparison_models.train_comparison import BASELINES, HERE
from ml_pipeline.train import DEVICE, WEIGHTS_PATH, evaluate, loader, window_datasets
from model import AFCNN_LSTM

if __name__ == '__main__':
    _, _, test_set = window_datasets()
    test_loader = loader(test_set)
    models = [(n, c, os.path.join(HERE, f)) for n, c, f in BASELINES] + [("1D CNN-LSTM", AFCNN_LSTM, WEIGHTS_PATH)]

    results = {}
    plt.figure(figsize=(8, 7))
    for name, model_class, path in models:
        if not os.path.exists(path):
            print(f"Skipping {name}: {path} not found")
            continue
        model = model_class().to(DEVICE)
        model.load_state_dict(torch.load(path, map_location=DEVICE, weights_only=True))
        results[name], y, p = evaluate(model, test_loader, name)
        fpr, tpr, _ = roc_curve(y, p)
        plt.plot(fpr, tpr, label=f"{name} (AUC = {results[name]['ROC-AUC']:.3f})")

    plt.plot([0, 1], [0, 1], 'k--', label='Chance')
    plt.xlabel('False Positive Rate (1 - Specificity)')
    plt.ylabel('True Positive Rate (Sensitivity)')
    plt.title('Window-level AFib detection, held-out test patients')
    plt.legend(loc='lower right')
    plt.grid(True)
    plt.savefig(os.path.join(HERE, 'roc_curves.png'))

    with open(os.path.join(HERE, 'benchmark_results.json'), 'w') as f:
        json.dump(results, f, indent=4)
    print("Saved roc_curves.png and benchmark_results.json")
