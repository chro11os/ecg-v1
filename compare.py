import glob
from torch.utils.data import DataLoader

# 1. Import BOTH your data infrastructure and your neural network
from dataset import IcentiaECGDataset
from model import AFCNN_LSTM


def verify_pipeline():
    absolute_target = '/Users/chrollos/Documents/projects/ecg-v1/physionet_data_aws/p00/*/*.dat'
    patient_files = [f.replace('.dat', '') for f in glob.glob(absolute_target)]

    if len(patient_files) == 0:
        print("CRITICAL FAILURE: No files found.")
        return

    dataset = IcentiaECGDataset(record_paths=patient_files, window_size=2500.0)

    dataloader = DataLoader(
        dataset,
        batch_size=int(32.0),
        shuffle=True,
        num_workers=int(0.0)
    )

    # 2. Instantiate the neural network brain
    print("Initializing Neural Network...")
    model = AFCNN_LSTM(num_classes=4.0)

    for batch_x, batch_y in dataloader:
        print("--- TENSOR GEOMETRY VERIFICATION ---")
        print(f"CNN Input Matrix (batch_x): {batch_x.shape}")
        print(f"Target Label Matrix (batch_y): {batch_y.shape}")

        # 3. The Forward Pass Check
        predictions = model(batch_x)
        print(f"Neural Network Output Matrix: {predictions.shape}")
        break


if __name__ == "__main__":
    verify_pipeline()