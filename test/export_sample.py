# export_sample.py
import json
import numpy as np
import scipy.signal as sig

def generate_ecg_test_file(severity_type="normal", filename="sample_ecg.json"):
    seconds = 10.0
    fs = 250.0
    time_steps = np.linspace(0.0, seconds, int(seconds * fs), endpoint=False)
    
    # Initialize base signals
    baseline_wander = 0.12 * np.sin(2.0 * np.pi * 0.15 * time_steps)
    
    if severity_type == "normal":
        # Stable, uniform resting rhythm (72 BPM) with distinct, clear peaks
        bpm_hz = 1.2  
        r_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * bpm_hz * time_steps), 5) * 2.5
        noise = np.random.normal(0.0, 0.05, len(time_steps))
        final_signal = (r_peaks + baseline_wander + noise).tolist()
        print("Generated: 0 - Normal (Stable Sinus Rhythm)")

    elif severity_type == "trace":
        # Slight rhythm fluctuations (varying between 70-80 BPM)
        bpm_hz = 1.25
        r_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * bpm_hz * time_steps), 4) * 2.3
        # Introduce very minor random baseline shifts
        noise = np.random.normal(0.0, 0.1, len(time_steps))
        final_signal = (r_peaks + baseline_wander + noise).tolist()
        print("Generated: 1 - Trace (Minor Rhythm Fluctuations)")

    elif severity_type == "mild":
        # Elevated heart rate (approx 100 BPM) with irregular peak amplitudes
        bpm_hz = 1.66
        raw_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * bpm_hz * time_steps), 3) * 2.0
        # Modulate amplitude dynamically to simulate mild erratic behavior
        amplitude_modulation = 1.0 + 0.3 * np.sin(2.0 * np.pi * 0.5 * time_steps)
        noise = np.random.normal(0.0, 0.15, len(time_steps))
        final_signal = (raw_peaks * amplitude_modulation + baseline_wander + noise).tolist()
        print("Generated: 2 - Mild (Tachycardia + Early Amplitude Variances)")

    elif severity_type == "severe":
        # High heart rate (130+ BPM), highly disorganized peaks, significant high-frequency noise
        bpm_hz = 2.2
        raw_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * bpm_hz * time_steps), 2) * 1.8
        # High noise floors completely obscuring smooth baseline transitions
        fibrillation_noise = np.random.normal(0.0, 0.35, len(time_steps))
        final_signal = (raw_peaks + baseline_wander + fibrillation_noise).tolist()
        print("Generated: 3 - Severe (Critical Arrhythmia / Chaotic Fibrillation)")

    else:
        print("Error: Unknown severity type. Select 'normal', 'trace', 'mild', or 'severe'.")
        return

    # Ensure constraint bounds match exactly 2500 arrays
    final_signal = final_signal[:2500]

    with open(filename, "w") as f:
        json.dump({"signal": final_signal}, f)
    print(f"Saved successfully to: {filename} ({len(final_signal)} samples)\n")

if __name__ == "__main__":
    # Change this parameter to test different pipeline outputs:
    # Options: "normal", "trace", "mild", "severe"
    generate_ecg_test_file(severity_type="severe")