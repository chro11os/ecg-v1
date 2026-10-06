import os
import sys

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import confusion_matrix, roc_auc_score
from torch.utils.data import DataLoader

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_pipeline.dataset import PROJECT_ROOT, ECGWindowDataset, load_cache, patient_split
from model import AFCNN_LSTM

WEIGHTS_PATH = os.path.join(PROJECT_ROOT, 'afib_cnn_lstm_v1.pt')
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')


def window_datasets():
    """Train / val / test window datasets over a patient-wise split.
    Train adds extra AFib windows; val and test keep the natural AFib prevalence."""
    splits = patient_split(load_cache())
    return (ECGWindowDataset(splits['train'], windows_per_record=10, afib_windows_per_record=10, seed=0),
            ECGWindowDataset(splits['val'], windows_per_record=20, seed=1),
            ECGWindowDataset(splits['test'], windows_per_record=20, seed=2))


def loader(dataset, shuffle=False):
    return DataLoader(dataset, batch_size=64, shuffle=shuffle, num_workers=4,
                      pin_memory=DEVICE.type == 'cuda', persistent_workers=True)


def predict(model, data_loader):
    """(labels, P(AFib)) over a loader."""
    model.eval()
    ys, ps = [], []
    with torch.no_grad():
        for x, y in data_loader:
            ps.append(torch.softmax(model(x.to(DEVICE)), dim=1)[:, 1].cpu().numpy())
            ys.append(y.numpy())
    return np.concatenate(ys), np.concatenate(ps)


def evaluate(model, data_loader, name):
    """Window-level AFib detection metrics at a 0.5 threshold."""
    y, p = predict(model, data_loader)
    tn, fp, fn, tp = confusion_matrix(y, p >= 0.5, labels=[0, 1]).ravel()
    m = {
        'ROC-AUC': roc_auc_score(y, p) if len(set(y)) > 1 else float('nan'),
        'Sensitivity': tp / max(tp + fn, 1),
        'Specificity': tn / max(tn + fp, 1),
        'Precision': tp / max(tp + fp, 1),
        'F1': 2 * tp / max(2 * tp + fp + fn, 1),
        'Accuracy': (tp + tn) / len(y),
        'Confusion Matrix': [[int(tn), int(fp)], [int(fn), int(tp)]],
    }
    print(f"[{name}] {len(y)} windows ({int(y.sum())} AFib) | "
          + " | ".join(f"{k} {v:.4f}" for k, v in m.items() if k != 'Confusion Matrix')
          + f" | CM [[TN FP] [FN TP]] {m['Confusion Matrix']}")
    return m, y, p


def fit(model, train_set, val_set, save_path, epochs=10, lr=1e-3):
    """Train with class-weighted cross-entropy; keep the epoch with the best validation ROC-AUC."""
    torch.manual_seed(42)
    model.to(DEVICE)
    labels = train_set.labels
    n_pos = max(int(labels.sum()), 1)
    weight = torch.tensor([1.0, (len(labels) - n_pos) / n_pos], device=DEVICE)
    criterion = nn.CrossEntropyLoss(weight=weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    print(f"Train windows: {len(labels)} ({n_pos} AFib) | Val windows: {len(val_set)} | Device: {DEVICE}")

    train_loader, val_loader = loader(train_set, shuffle=True), loader(val_set)
    best_auc = -1.0
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(DEVICE), y.to(DEVICE)
            optimizer.zero_grad()
            loss = criterion(model(x), y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        m, _, _ = evaluate(model, val_loader, f"epoch {epoch} val | train loss {total_loss / len(train_loader):.4f}")
        if m['ROC-AUC'] > best_auc or np.isnan(m['ROC-AUC']):  # NaN: val split has no AFib windows
            best_auc = m['ROC-AUC']
            torch.save(model.state_dict(), save_path)
            print(f"  saved best model -> {save_path}")

    model.load_state_dict(torch.load(save_path, map_location=DEVICE, weights_only=True))
    return model


if __name__ == '__main__':
    train_set, val_set, test_set = window_datasets()
    model = fit(AFCNN_LSTM(), train_set, val_set, WEIGHTS_PATH)
    evaluate(model, loader(test_set), "test")
