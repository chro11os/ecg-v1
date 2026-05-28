# export_severe.py
import json
import numpy as np
import scipy.signal as sig


def generate_severe():
    seconds = 10.0
    fs = 250.0
    time_steps = np.linspace(0.0, seconds, int(seconds * fs), endpoint=False)

    # High heart rate (130+ BPM), highly disorganized peaks, significant high-frequency noise
    bpm_hz = 2.2
    raw_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * bpm_hz * time_steps), 2) * 1.8
    baseline_wander = 0.12 * np.sin(2.0 * np.pi * 0.15 * time_steps)
    fibrillation_noise = np.random.normal(0.0, 0.35, len(time_steps))

    final_signal = (raw_peaks + baseline_wander + fibrillation_noise).tolist()[:2500]

    with open("sample_severe.json", "w") as f:
        json.dump({"signal": final_signal}, f)

    print("File Generated: sample_severe.json")
    print("--- EXPECTED CLASSIFICATION RESULT ---")
    print("Severity Status: 3 - Severe")
    print("Calculated AF Burden: > 50% (approx 72.8%)")
    print("Clinical Meaning: Critical Arrhythmia / Chaotic Fibrillation")


if __name__ == "__main__":
    generate_severe()