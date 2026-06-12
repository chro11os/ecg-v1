import os
import sys
import glob
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

# Ensure the parent directory is in the path to import model.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dataset import IcentiaECGDataset
from model import AFCNN_LSTM
from main import evaluate_model

def run_evaluation():
    # 1. Hardware target
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"--- HARDWARE TARGET LOCK ---")
    print(f"Executing PyTorch math on: {device}")
    if device.type == "cuda":
        print(f"ROCm GPU Acceleration Enabled: {torch.cuda.get_device_name(0)}")
    
    # 2. Gather patient files (expecting to run inside ml_pipeline/ directory)
    absolute_target = './physionet_data_aws/p0*/*/*.dat'
    patient_files = [f.replace('.dat', '') for f in glob.glob(absolute_target)]
    
    if len(patient_files) == 0:
        # Fallback to check relative paths if run from root
        absolute_target = './ml_pipeline/physionet_data_aws/p0*/*/*.dat'
        patient_files = [f.replace('.dat', '') for f in glob.glob(absolute_target)]
        
    if len(patient_files) == 0:
        print("CRITICAL FAILURE: No files found. Check your absolute path and working directory.")
        return
        
    print(f"Found {len(patient_files)} patient files in database.")
    
    # 3. Initialize dataset
    dataset = IcentiaECGDataset(record_paths=patient_files, window_size=500.0)
    
    # Calculate 70/15/15 split dynamically (matching main.py exactly)
    total_size = len(dataset)
    train_size = int(0.70 * total_size)
    val_size = int(0.15 * total_size)
    test_size = total_size - train_size - val_size
    
    # Split using manual seed for reproducibility
    _, _, test_dataset = torch.utils.data.random_split(
        dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )
    
    print(f"Testing Split Size: {len(test_dataset)} records (15% of total dataset)")
    
    # 4. Create loader
    test_loader = DataLoader(
        test_dataset, batch_size=64, shuffle=False,
        num_workers=4, pin_memory=True, persistent_workers=True
    )
    
    # 5. Model initialization & load weights
    model = AFCNN_LSTM(num_classes=4).to(device)
    
    weights_path = "afib_cnn_lstm_v1.pt"
    if not os.path.exists(weights_path):
        # Fallback to root or check parent
        weights_path = "../afib_cnn_lstm_v1.pt"
        if not os.path.exists(weights_path):
            weights_path = "ml_pipeline/afib_cnn_lstm_v1.pt"
            if not os.path.exists(weights_path):
                print("CRITICAL FAILURE: Model weights file (afib_cnn_lstm_v1.pt) not found.")
                return
                
    print(f"Loading model weights from: {weights_path}")
    model.load_state_dict(torch.load(weights_path, map_location=device))
    
    # 6. Run evaluation
    print("Initiating test evaluation...")
    evaluate_model(model, test_loader, device, phase_name="Final Test Split")

if __name__ == "__main__":
    run_evaluation()
