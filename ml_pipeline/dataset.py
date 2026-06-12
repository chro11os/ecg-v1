import torch
from torch.utils.data import Dataset
import wfdb
import numpy as np
import scipy.signal

def bandpass_filter(data, lowcut=0.5, highcut=45.0, fs=250.0, order=4):
    """
    Applies a Butterworth bandpass filter to remove baseline wander and high-frequency noise.
    """
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = scipy.signal.butter(order, [low, high], btype='band')
    return scipy.signal.filtfilt(b, a, data)

def min_max_normalize(data):
    """
    Normalizes a 1D numpy array to [0, 1] range.
    """
    min_val = np.min(data)
    max_val = np.max(data)
    denom = max_val - min_val
    if denom == 0:
        return np.zeros_like(data)
    return (data - min_val) / denom

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
    Lazy-loading Dataset class to pipe 1D ECG voltage arrays into PyTorch.
    Optimized for multi-process loaders and cached for high epoch iteration speed.
    """
    def __init__(self, record_paths, window_size=500.0):
        # window_size 500.0 = exactly 2.0 seconds at 250.0 Hz
        self.record_paths = record_paths
        self.window_size = int(window_size)
        self.label_cache = {}

    def __len__(self):
        return len(self.record_paths)

    def __getitem__(self, idx):
        record_path = self.record_paths[idx]

        # 1. Read ONLY the required slice from the hard drive
        record = wfdb.rdrecord(record_path, sampfrom=0, sampto=self.window_size)

        # 2. Extract 1D array and force float32
        raw_signal = record.p_signal[:, 0].astype(np.float32)

        # 3. Apply band-pass filter (0.5 Hz - 45 Hz)
        filtered_signal = bandpass_filter(raw_signal, lowcut=0.5, highcut=45.0, fs=250.0)

        # 4. Apply Min-Max normalization to range [0, 1]
        normalized_signal = min_max_normalize(filtered_signal)

        # 5. Shape for 1D CNN: (Channels, Sequence_Length) -> (1, 500)
        tensor_x = torch.tensor(normalized_signal, dtype=torch.float32).unsqueeze(0)

        # 6. Retrieve or calculate the severity label
        if idx in self.label_cache:
            severity_float = self.label_cache[idx]
        else:
            severity_float = calculate_severity_from_atr(record_path)
            self.label_cache[idx] = severity_float

        tensor_y = torch.tensor(severity_float, dtype=torch.long)

        return tensor_x, tensor_y