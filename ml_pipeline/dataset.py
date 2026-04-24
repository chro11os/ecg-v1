import torch
from torch.utils.data import Dataset
import wfdb
import numpy as np

def calculate_severity_from_atr(file_path):
    """
    Reads an Icentia11k .atr file and calculates the AF Burden severity integer.
    """
    try:
        annotation = wfdb.rdann(file_path, 'atr')
    except FileNotFoundError:
        # Failsafe: If an annotation file is missing, default to 0.0 to prevent training crashes
        return 0.0

    sample_indices = annotation.sample  
    symbols = annotation.symbol  
    aux_notes = annotation.aux_note  

    total_samples = sample_indices[-1] if len(sample_indices) > 0 else 0

    if total_samples == 0:
        return 0.0

    total_af_samples = 0
    in_afib = False
    afib_start_idx = 0

    for i, symbol in enumerate(symbols):
        note = aux_notes[i] if i < len(aux_notes) else ""

        if "(AFIB" in note and not in_afib:
            in_afib = True
            afib_start_idx = sample_indices[i]

        elif ("(N" in note or "(SVTA" in note or "(AFL" in note) and in_afib:
            in_afib = False
            total_af_samples += (sample_indices[i] - afib_start_idx)

    if in_afib:
        total_af_samples += (total_samples - afib_start_idx)

    # Calculate AF Burden
    af_burden = total_af_samples / total_samples

    # Map to severity targets
    if af_burden == 0.0:
        return 0.0  
    elif af_burden < 0.05:
        return 1.0  
    elif af_burden < 0.50:
        return 2.0  
    else:
        return 3.0  


class IcentiaECGDataset(Dataset):
    """
    Lazy-loading Dataset class to pipe 1D ECG voltage arrays into Apple Silicon.
    """
    def __init__(self, record_paths, window_size=2500.0):
        # window_size 2500.0 = exactly 10.0 seconds at 250.0 Hz
        self.record_paths = record_paths
        self.window_size = int(window_size)

    def __len__(self):
        return len(self.record_paths)

    def __getitem__(self, idx):
        record_path = self.record_paths[idx]

        # 1. Read ONLY the required slice from the hard drive
        record = wfdb.rdrecord(record_path, sampfrom=0, sampto=self.window_size)

        # 2. Extract 1D array and force float32
        raw_signal = record.p_signal[:, 0].astype(np.float32)

        # 3. Shape for 1D CNN: (Channels, Sequence_Length) -> (1, 2500)
        tensor_x = torch.tensor(raw_signal).unsqueeze(0)

        # 4. Attach severity label
        severity_float = calculate_severity_from_atr(record_path)
        tensor_y = torch.tensor(severity_float, dtype=torch.long)

        return tensor_x, tensor_y