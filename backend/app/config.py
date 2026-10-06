import os
import torch

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEIGHTS_PATH = os.path.join(PROJECT_ROOT, "afib_cnn_lstm_v1.pt")

# Crossplatform hardware acceleration (CUDA/ROCm -> Apple Silicon MPS -> CPU)
if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
elif torch.backends.mps.is_available():
    DEVICE = torch.device("mps")
else:
    DEVICE = torch.device("cpu")
