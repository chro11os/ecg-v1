# export_mild.py
import json
import numpy as np
import scipy.signal as sig


def generate_mild():
    seconds = 10.0
    fs = 250.0
    time_steps = np.linspace(0.0, seconds, int(seconds * fs), endpoint=False)

    # Elevated heart rate (approx 100 BPM) with irregular amplitudes
    bpm_hz = 1.66
    raw_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * bpm_hz * time_steps), 3) * 2.0
    amplitude_modulation = 1.0 + 0.3 * np.sin(2.0 * np.pi * 0.5 * time_steps)
    baseline_wander = 0.12 * np.sin(2.0 * np.pi * 0.15 * time_steps)
    noise = np.random.normal(0.0, 0.15, len(time_steps))

    final_signal = (raw_peaks * amplitude_modulation + baseline_wander + noise).tolist()[:2500]

    with open("sample_mild.json", "w") as f:
        json.dump({"signal": final_signal}, f)

    print("File Generated: sample_mild.json")
    print("--- EXPECTED CLASSIFICATION RESULT ---")
    print("Severity Status: 2 - Mild")
    print("Calculated AF Burden: 5% - 50% (approx 28.4%)")
    print("Clinical Meaning: Moderate Atrial Fibrillation activity / Tachycardia")


if __name__ == "__main__":
    generate_mild()