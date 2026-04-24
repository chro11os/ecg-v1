import torch
import fastapi
import pydantic
from model import AFCNN_LSTM


def check_hardware():
    print(f"--- HARDWARE SCAN ---")
    mps_available = torch.backends.mps.is_available()
    print(f"MPS (Apple Silicon GPU) Available: {mps_available}")

    if mps_available:
        device = torch.device("mps")
        # Quick tensor math test to verify the backend is actually functional
        x = torch.ones(1, device=device)
        print(f"MPS Math Test: Success")
    else:
        print("WARNING: MPS not found. Check your 'torch' version.")




def check_local_imports():
    print(f"\n--- MODULE RESOLUTION ---")
    try:
        # Verify architecture instantiation
        test_model = AFCNN_LSTM(num_classes=4)
        print("Model architecture (AFCNN_LSTM) resolved: Success")

        # Verify weights accessibility
        weights_path = "afib_cnn_lstm_v1.pt"
        state_dict = torch.load(weights_path, map_location="cpu")
        test_model.load_state_dict(state_dict)
        print(f"Weights ({weights_path}) loaded: Success")
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")


if __name__ == "__main__":
    check_hardware()
    check_local_imports()