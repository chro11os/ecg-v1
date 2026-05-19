# export_sample.py
import json
import numpy as np
import scipy.signal as sig

def generate_clean_ecg(filename="sample_ecg.json"):
    # Create a synthetic 10-second heartbeat rhythm at 250Hz
    seconds = 10.0
    fs = 250.0
    time_steps = np.linspace(0.0, seconds, int(seconds * fs), endpoint=False)
    
    # Simulate a steady 72 BPM resting heart rate peak rhythm
    r_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * 1.2 * time_steps), 5) * 2.5
    
    # Add a baseline wander and minimal high-frequency channel noise
    baseline = 0.15 * np.sin(2.0 * np.pi * 0.1 * time_steps)
    white_noise = np.random.normal(0.0, 0.08, len(time_steps))
    
    final_signal = (r_peaks + baseline + white_noise).tolist()
    
    with open(filename, "w") as f:
        json.dump({"signal": final_signal}, f)
    print(f"Successfully generated clean synthetic ECG data file: {filename}")

if __name__ == "__main__":
    generate_clean_ecg()
