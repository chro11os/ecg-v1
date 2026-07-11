import numpy as np
import scipy.signal as sig
from typing import List, Tuple

def apply_bandpass_filter(signal: np.ndarray, fs: float = 250.0) -> np.ndarray:
    nyquist = 0.5 * fs
    low = 0.5 / nyquist
    high = 45.0 / nyquist
    b, a = sig.butter(4, [low, high], btype='band')
    return sig.filtfilt(b, a, signal)

def apply_min_max_normalization(signal: np.ndarray) -> np.ndarray:
    min_val = np.min(signal)
    max_val = np.max(signal)
    denom = max_val - min_val
    return (signal - min_val) / denom if denom != 0 else np.zeros_like(signal)

def extract_ecg_landmarks(raw_signal: np.ndarray, fs: float = 250.0) -> Tuple[List[int], float, float]:
    filtered_signal = apply_bandpass_filter(raw_signal, fs)
    max_val_filtered = np.max(filtered_signal)
    r_peaks, _ = sig.find_peaks(filtered_signal, distance=100, height=max_val_filtered * 0.45)
    r_peaks_list = r_peaks.tolist()

    if len(r_peaks_list) > 1:
        rr_intervals_ms = np.diff(r_peaks) * (1000.0 / fs)  # For fs=250, 4.0ms per sample
        rr_variance = float(np.var(rr_intervals_ms))
        diff_rr = np.diff(rr_intervals_ms)
        rmssd = float(np.sqrt(np.mean(diff_rr ** 2))) if len(diff_rr) > 0 else 0.0
    else:
        rr_variance = 0.0
        rmssd = 0.0

    return r_peaks_list, rr_variance, rmssd
