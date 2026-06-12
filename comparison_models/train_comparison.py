import os
import sys
import json
import time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

# Add parent directory to path to locate ml_pipeline
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_pipeline.dataset import IcentiaECGDataset
from models import Standalone1DCNN, StandaloneLSTM, CNN_GRU, CNN_BiLSTM, ECGTransformer

def train_single_model(model_name, model_class, train_loader, device, save_filename, lr=0.001, epochs=3):
    print(f"\n==================================================")
    print(f"TRAINING MODEL: {model_name}")
    print(f"==================================================")

    model = model_class().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    # Reset max memory tracking
    if device.type == "cuda":
        torch.cuda.reset_peak_memory_stats(device)

    start_time = time.time()

    for epoch in range(epochs):
        epoch_start = time.time()
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for x_batch, y_batch in train_loader:
            x_batch, y_batch = x_batch.to(device), y_batch.to(device)

            optimizer.zero_grad()
            outputs = model(x_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            _, predicted = torch.max(outputs, 1)
            total += y_batch.size(0)
            correct += (predicted == y_batch).sum().item()

        epoch_time = time.time() - epoch_start
        epoch_loss = running_loss / len(train_loader)
        epoch_acc = (correct / total) * 100.0

        # Track resource utilization (VRAM)
        mem_allocated = 0.0
        if device.type == "cuda":
            mem_allocated = torch.cuda.max_memory_allocated(device) / (1024 ** 2) # in MB

        print(f"Epoch [{epoch+1}/{epochs}] | Loss: {epoch_loss:.4f} | Train Acc: {epoch_acc:.2f}% | Time: {epoch_time:.2f}s | Peak VRAM: {mem_allocated:.2f} MB")

    total_time = time.time() - start_time
    print(f"Finished training {model_name} in {total_time:.2f}s.")

    # Save weights
    save_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), save_filename)
    torch.save(model.state_dict(), save_path)
    print(f"Weights successfully saved to: {save_path}")
    return total_time

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"--- HARDWARE TARGET LOCK ---")
    print(f"Executing PyTorch math on: {device}")
    if device.type == "cuda":
        print(f"ROCm GPU Acceleration Enabled: {torch.cuda.get_device_name(0)}")

    # Load splits layout
    layout_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "split_layout.json")
    if not os.path.exists(layout_path):
        print(f"CRITICAL FAILURE: split_layout.json not found. Run prepare_splits.py first.")
        return

    with open(layout_path, "r") as f:
        layout = json.load(f)

    train_files = layout["train"]

    # Datasets
    train_dataset = IcentiaECGDataset(record_paths=train_files, window_size=500.0)

    # Loaders with optimal multithreading configurations
    train_loader = DataLoader(
        train_dataset, batch_size=64, shuffle=True,
        num_workers=4, pin_memory=True, persistent_workers=True
    )

    # Model specifications mapping
    models_to_train = [
        ("Standalone 1D CNN", Standalone1DCNN, "baseline_cnn.pth"),
        ("Standalone LSTM", StandaloneLSTM, "baseline_lstm.pth"),
        ("1D CNN-GRU", CNN_GRU, "hybrid_gru.pth"),
        ("Bidirectional LSTM (BiLSTM)", CNN_BiLSTM, "hybrid_bilstm.pth"),
        ("Lightweight Transformer", ECGTransformer, "baseline_transformer.pth")
    ]

    times = {}
    for name, model_class, filename in models_to_train:
        times[name] = train_single_model(name, model_class, train_loader, device, filename)

    print("\n==================================================")
    print("ALL MODELS TRAINED SUCCESSFULLY")
    print("==================================================")
    for name, t in times.items():
        print(f"{name}: {t:.2f} seconds total training time")

if __name__ == "__main__":
    main()
