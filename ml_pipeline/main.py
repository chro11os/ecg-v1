import os
import sys
import glob
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score, confusion_matrix

# Ensure the parent directory is in the path to import model.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dataset import IcentiaECGDataset
from model import AFCNN_LSTM

def evaluate_model(model, data_loader, device, phase_name="Validation"):
    model.eval()
    all_preds = []
    all_targets = []
    all_probs = []
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()

    with torch.no_grad():
        for batch_x, batch_y in data_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            total_loss += loss.item()

            probs = torch.softmax(outputs, dim=1)
            _, preds = torch.max(outputs, dim=1)

            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(batch_y.cpu().numpy())
            all_probs.extend(probs.cpu().numpy())

    avg_loss = total_loss / len(data_loader)
    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)
    all_probs = np.array(all_probs)

    acc = accuracy_score(all_targets, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(all_targets, all_preds, average='macro', zero_division=0)
    
    # Calculate ROC-AUC score safely (handling cases with missing classes)
    try:
        # Check unique classes present in validation/test set targets
        classes_present = np.unique(all_targets)
        if len(classes_present) > 1:
            # We calculate One-vs-Rest ROC-AUC score only for classes that have
            # both positive and negative examples in the target split.
            num_classes = all_probs.shape[1]
            roc_aucs = []
            for c in range(num_classes):
                y_true_c = (all_targets == c).astype(int)
                # Ensure class c has at least one positive and one negative sample
                if len(np.unique(y_true_c)) > 1:
                    score = roc_auc_score(y_true_c, all_probs[:, c])
                    roc_aucs.append(score)
            
            if len(roc_aucs) > 0:
                roc_auc = np.mean(roc_aucs)
            else:
                roc_auc = 0.0
        else:
            roc_auc = 0.0
    except Exception:
        roc_auc = 0.0

    print(f"\n================ {phase_name.upper()} RESULTS ================")
    print(f"Loss: {avg_loss:.4f}")
    print(f"Accuracy: {acc * 100:.2f}%")
    print(f"Precision (Macro): {precision * 100:.2f}%")
    print(f"Recall/Sensitivity (Macro): {recall * 100:.2f}%")
    print(f"F1-Score (Macro): {f1 * 100:.2f}%")
    print(f"ROC-AUC (Macro OVR): {roc_auc:.4f}")
    
    cm = confusion_matrix(all_targets, all_preds)
    print("Confusion Matrix:")
    print(cm)
    print("====================================================\n")
    
    return avg_loss, acc, precision, recall, f1, roc_auc

def train_model():
    # 1. Hardware Initialization for AMD ROCm
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"--- HARDWARE TARGET LOCK ---")
    print(f"Executing PyTorch math on: {device}")
    if device.type == "cuda":
        print(f"ROCm GPU Acceleration Enabled: {torch.cuda.get_device_name(0)}")
        print(f"CUDA Version: {torch.version.cuda}")
        print(f"ROCm Version: {torch.version.hip if hasattr(torch.version, 'hip') else 'ROCm (Built-in)'}")
    else:
        print("WARNING: Using CPU. ROCm acceleration is not available.")

    # Target p00 and p01 datasets dynamically (covers all directories matching p0*)
    absolute_target = './physionet_data_aws/p0*/*/*.dat'
    patient_files = [f.replace('.dat', '') for f in glob.glob(absolute_target)]

    if len(patient_files) == 0:
        print("CRITICAL FAILURE: No files found. Check your absolute path.")
        return

    # window_size = 500 samples (2.0 seconds @ 250.0 Hz)
    dataset = IcentiaECGDataset(record_paths=patient_files, window_size=500.0)

    # Calculate 70/15/15 split dynamically
    total_size = len(dataset)
    train_size = int(0.70 * total_size)
    val_size = int(0.15 * total_size)
    test_size = total_size - train_size - val_size

    # Split using manual seed for reproducibility
    train_dataset, val_dataset, test_dataset = torch.utils.data.random_split(
        dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )

    print(f"Dataset Size: {total_size} records")
    print(f"Training Split: {len(train_dataset)} records (70%)")
    print(f"Validation Split: {len(val_dataset)} records (15%)")
    print(f"Testing Split: {len(test_dataset)} records (15%)")

    # High-efficiency multi-process data loading optimized for Ryzen 7 5700X and 32GB RAM
    # num_workers=4 balances physical/logical core context switching; pin_memory=True speeds up transfer to ROCm GPU.
    train_loader = DataLoader(
        train_dataset, batch_size=64, shuffle=True,
        num_workers=4, pin_memory=True, persistent_workers=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=64, shuffle=False,
        num_workers=4, pin_memory=True, persistent_workers=True
    )
    test_loader = DataLoader(
        test_dataset, batch_size=64, shuffle=False,
        num_workers=4, pin_memory=True, persistent_workers=True
    )

    # 3. Model Initialization
    model = AFCNN_LSTM(num_classes=4).to(device)

    # 4. Optimization Math
    class_weights = torch.tensor([1.0, 15.0, 15.0, 15.0], dtype=torch.float32).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    epochs = 3

    print("--- INITIATING TRAINING LOOP ---")
    for epoch in range(epochs):
        # ==========================================
        # PHASE A: TRAINING
        # ==========================================
        model.train()
        running_loss = 0.0
        correct_predictions = 0.0
        total_predictions = 0.0

        for batch_idx, (batch_x, batch_y) in enumerate(train_loader):
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)

            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total_predictions += batch_y.size(0)
            correct_predictions += (predicted == batch_y).sum().item()

            if batch_idx % 50 == 0:
                current_accuracy = (correct_predictions / total_predictions) * 100.0
                print(f"Epoch [{epoch + 1}/{epochs}] | Batch [{batch_idx}/{len(train_loader)}] | Loss: {loss.item():.4f} | Train Acc: {current_accuracy:.2f}%")

        # Epoch Summary
        epoch_accuracy = (correct_predictions / total_predictions) * 100.0
        print(f"*** EPOCH {epoch + 1} TRAINING COMPLETE | Avg Loss: {running_loss / len(train_loader):.4f} | Train Accuracy: {epoch_accuracy:.2f}% ***")

        # ==========================================
        # PHASE B: BLIND VALIDATION
        # ==========================================
        evaluate_model(model, val_loader, device, phase_name=f"Epoch {epoch + 1} Validation")

    # ==========================================
    # PHASE C: FINAL TEST EVALUATION
    # ==========================================
    print("--- INITIATING FINAL TEST EVALUATION ---")
    evaluate_model(model, test_loader, device, phase_name="Final Test")

    # 5. Model Serialization (The Final Export)
    print("--- INITIATING WEIGHT EXPORT ---")
    save_path = "afib_cnn_lstm_v1.pt"
    torch.save(model.state_dict(), save_path)
    print(f"Success: Neural network weights strictly locked and saved to {save_path}")

    # Automatically synchronize weights file to API backend and root directories for convenience
    try:
        import shutil
        backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../fast_api_backend/afib_cnn_lstm_v1.pt"))
        shutil.copy2(save_path, backend_path)
        print(f"Convenience Sync: Weights successfully copied to backend at {backend_path}")

        root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../afib_cnn_lstm_v1.pt"))
        shutil.copy2(save_path, root_path)
        print(f"Convenience Sync: Weights successfully copied to root at {root_path}")
    except Exception as e:
        print(f"Convenience Sync Note: Could not auto-sync weights file ({e}). You may need to copy it manually.")

if __name__ == "__main__":
    train_model()

