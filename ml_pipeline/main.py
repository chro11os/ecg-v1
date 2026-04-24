import glob
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from dataset import IcentiaECGDataset
from model import AFCNN_LSTM

def train_model():
    # 1. Hardware Initialization
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"--- HARDWARE TARGET LOCK ---")
    print(f"Executing PyTorch math on: {device}")

    # 2. Data Pipeline (with Strict Academic Splitting)
    absolute_target = './physionet_data_aws/p00/*/*.dat'
    patient_files = [f.replace('.dat', '') for f in glob.glob(absolute_target)]

    if len(patient_files) == 0:
        print("CRITICAL FAILURE: No files found. Check your absolute path.")
        return

    dataset = IcentiaECGDataset(record_paths=patient_files, window_size=2500.0)

    # Calculate the 80/20 split dynamically
    train_size = int(0.8 * len(dataset))
    test_size = len(dataset) - train_size

    # Mathematically sever the dataset into two isolated pools
    train_dataset, test_dataset = torch.utils.data.random_split(dataset, [train_size, test_size])

    # Create distinct assembly lines
    train_loader = DataLoader(train_dataset, batch_size=int(32.0), shuffle=True, num_workers=int(0.0))
    test_loader = DataLoader(test_dataset, batch_size=int(32.0), shuffle=False, num_workers=int(0.0))

    # 3. Model Initialization
    model = AFCNN_LSTM(num_classes=4.0).to(device)

    # 4. Optimization Math
    class_weights = torch.tensor([1.0, 15.0, 15.0, 15.0], dtype=torch.float32).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    epochs = int(3.0)

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
            _, predicted = torch.max(outputs.data, int(1.0))
            total_predictions += batch_y.size(int(0.0))
            correct_predictions += (predicted == batch_y).sum().item()

            if batch_idx % int(50.0) == int(0.0):
                current_accuracy = (correct_predictions / total_predictions) * 100.0
                print(f"Epoch [{epoch + 1}/{epochs}] | Batch [{batch_idx}/{len(train_loader)}] | Loss: {loss.item():.4f} | Train Acc: {current_accuracy:.2f}%")

        # Epoch Summary
        epoch_accuracy = (correct_predictions / total_predictions) * 100.0
        print(f"*** EPOCH {epoch + 1} TRAINING COMPLETE | Avg Loss: {running_loss / len(train_loader):.4f} | Train Accuracy: {epoch_accuracy:.2f}% ***")

        # ==========================================
        # PHASE B: BLIND VALIDATION
        # ==========================================
        model.eval()
        val_loss = 0.0
        val_correct = 0.0
        val_total = 0.0

        with torch.no_grad():
            for val_x, val_y in test_loader:
                val_x, val_y = val_x.to(device), val_y.to(device)
                val_outputs = model(val_x)

                loss = criterion(val_outputs, val_y)
                val_loss += loss.item()

                _, val_predicted = torch.max(val_outputs.data, int(1.0))
                val_total += val_y.size(int(0.0))
                val_correct += (val_predicted == val_y).sum().item()

        true_accuracy = (val_correct / val_total) * 100.0
        print(
            f"--> VALIDATION SCORE | Blind Loss: {val_loss / len(test_loader):.4f} | Blind Accuracy: {true_accuracy:.2f}%")
        print("-" * int(50.0))

        # 5. Model Serialization (The Final Export)
        # Notice this is completely un-indented from the epoch loop
    print("--- INITIATING WEIGHT EXPORT ---")
    save_path = "afib_cnn_lstm_v1.pt"
    torch.save(model.state_dict(), save_path)
    print(f"Success: Neural network weights strictly locked and saved to {save_path}")

if __name__ == "__main__":
    train_model()
