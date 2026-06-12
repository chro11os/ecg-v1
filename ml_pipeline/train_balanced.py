import os
import sys
import json
import random
import glob
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset

# Ensure the parent directory is in the path to import model.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dataset import IcentiaECGDataset
from model import AFCNN_LSTM
from main import evaluate_model

def train_balanced():
    # 1. Hardware Initialization for AMD ROCm
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"--- HARDWARE TARGET LOCK ---")
    print(f"Executing PyTorch math on: {device}")
    if device.type == "cuda":
        print(f"ROCm GPU Acceleration Enabled: {torch.cuda.get_device_name(0)}")
    else:
        print("WARNING: Using CPU. ROCm acceleration is not available.")

    # 2. Load the metadata cache
    cache_path = os.path.join(os.path.dirname(__file__), "metadata_cache.json")
    if not os.path.exists(cache_path):
        print("CRITICAL FAILURE: metadata_cache.json not found. Run build_metadata_cache.py first.")
        return
        
    with open(cache_path, "r") as f:
        cache_data = json.load(f)

    # 3. Group files by class to manage splitting and oversampling without leakage
    class_groups = {0: [], 1: [], 2: [], 3: []}
    for rel_path, label in cache_data.items():
        # Ensure path is valid locally
        abs_path = os.path.abspath(os.path.join(os.getcwd(), rel_path))
        if os.path.exists(abs_path + ".dat"):
            class_groups[label].append(abs_path)

    print("\n--- RESOLVED LOCAL FILE COUNTS ---")
    for cls in sorted(class_groups.keys()):
        print(f"Class {cls}: {len(class_groups[cls])} records")

    # 4. Perform Patient-Wise/File-Wise Split BEFORE oversampling to prevent Data Leakage
    train_files = []
    val_files = []
    test_files = []
    
    random.seed(42)
    
    # We split each class independently to maintain stratification
    for cls, files in class_groups.items():
        random.shuffle(files)
        total = len(files)
        tr_count = int(0.70 * total)
        val_count = int(0.15 * total)
        
        # Split lists
        cls_train = files[:tr_count]
        cls_val = files[tr_count:tr_count+val_count]
        cls_test = files[tr_count+val_count:]
        
        # Append to main splits
        val_files.extend(cls_val)
        test_files.extend(cls_test)
        
        # Balance/Oversample only the TRAINING split
        if len(cls_train) > 0:
            target_samples = 1000
            if cls == 0:
                # Undersample Class 0 to 1,000 files
                cls_train_balanced = random.sample(cls_train, min(target_samples, len(cls_train)))
            else:
                # Oversample Classes 1, 2, 3 to 1,000 files by duplicating
                cls_train_balanced = [random.choice(cls_train) for _ in range(target_samples)]
            train_files.extend(cls_train_balanced)

    # Shuffle the final balanced training set
    random.shuffle(train_files)

    print("\n--- SPLITS POST-BALANCING ---")
    print(f"Balanced Training Set: {len(train_files)} records (1,000 per class)")
    print(f"Raw Validation Set: {len(val_files)} records")
    print(f"Raw Testing Set: {len(test_files)} records")

    # 5. Initialize PyTorch datasets
    # Note: the dataset needs the files to be clean of .dat extension (rdrecord handles extensions)
    # The record_paths in the groups are already stripped of extensions by build_metadata_cache.py
    train_dataset = IcentiaECGDataset(record_paths=train_files, window_size=500.0)
    val_dataset = IcentiaECGDataset(record_paths=val_files, window_size=500.0)
    test_dataset = IcentiaECGDataset(record_paths=test_files, window_size=500.0)

    # 6. Loaders with high efficiency
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

    # 7. Model and Optimizer
    model = AFCNN_LSTM(num_classes=4).to(device)
    
    # Since the training set is perfectly balanced (1:1:1:1), we use standard unweighted CrossEntropyLoss
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    epochs = 5
    print("\n--- INITIATING BALANCED TRAINING LOOP ---")
    for epoch in range(epochs):
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

            if batch_idx % 20 == 0:
                current_accuracy = (correct_predictions / total_predictions) * 100.0
                print(f"Epoch [{epoch + 1}/{epochs}] | Batch [{batch_idx}/{len(train_loader)}] | Loss: {loss.item():.4f} | Train Acc: {current_accuracy:.2f}%")

        epoch_accuracy = (correct_predictions / total_predictions) * 100.0
        print(f"*** EPOCH {epoch + 1} COMPLETE | Avg Loss: {running_loss / len(train_loader):.4f} | Train Accuracy: {epoch_accuracy:.2f}% ***")

        # Validation at end of epoch
        evaluate_model(model, val_loader, device, phase_name=f"Epoch {epoch + 1} Validation")

    # 8. Final Test Evaluation
    print("--- INITIATING FINAL TEST EVALUATION ---")
    evaluate_model(model, test_loader, device, phase_name="Final Test Split")

    # 9. Serialize weights
    print("--- INITIATING WEIGHT EXPORT ---")
    save_path = "afib_cnn_lstm_v1.pt"
    torch.save(model.state_dict(), save_path)
    print(f"Success: Balanced model weights saved to {save_path}")

    # Synchronize weights to fast_api_backend and root
    try:
        import shutil
        backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../fast_api_backend/afib_cnn_lstm_v1.pt"))
        shutil.copy2(save_path, backend_path)
        print(f"Sync: Successfully copied to backend at {backend_path}")

        root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../afib_cnn_lstm_v1.pt"))
        shutil.copy2(save_path, root_path)
        print(f"Sync: Successfully copied to root at {root_path}")
    except Exception as e:
        print(f"Sync Note: Could not auto-sync weights ({e}). You may need to copy them manually.")

if __name__ == "__main__":
    train_balanced()
