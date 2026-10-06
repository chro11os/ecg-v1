import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from comparison_models.models import Standalone1DCNN, StandaloneLSTM, CNN_GRU, CNN_BiLSTM, ECGTransformer
from ml_pipeline.train import fit, window_datasets

HERE = os.path.dirname(os.path.abspath(__file__))

# Same windows, split, loss and best-val-AUC checkpointing as the main CNN-LSTM (ml_pipeline/train.py)
BASELINES = [
    ("Standalone 1D CNN", Standalone1DCNN, "baseline_cnn.pth"),
    ("Standalone LSTM", StandaloneLSTM, "baseline_lstm.pth"),
    ("1D CNN-GRU", CNN_GRU, "hybrid_gru.pth"),
    ("CNN-BiLSTM", CNN_BiLSTM, "hybrid_bilstm.pth"),
    ("Lightweight Transformer", ECGTransformer, "baseline_transformer.pth"),
]

if __name__ == '__main__':
    train_set, val_set, _ = window_datasets()
    for name, model_class, filename in BASELINES:
        print(f"\n=== {name} ===")
        start = time.time()
        fit(model_class(), train_set, val_set, os.path.join(HERE, filename))
        print(f"{name}: trained in {time.time() - start:.0f}s")
