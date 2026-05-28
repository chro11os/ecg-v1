# export_normal.py
import json
import numpy as np
import scipy.signal as sig


def generate_normal():
    seconds = 10.0
    fs = 250.0
    time_steps = np.linspace(0.0, seconds, int(seconds * fs), endpoint=False)

    # Stable, uniform resting rhythm (72 BPM) with distinct, clear peaks
    bpm_hz = 1.2
    r_peaks = sig.gauss_spline(np.sin(2.0 * np.pi * bpm_hz * time_steps), 5) * 2.5
    baseline_wander = 0.12 * np.sin(2.0 * np.pi * 0.15 * time_steps)
    noise = np.random.normal(0.0, 0.05, len(time_steps))

    final_signal = (r_peaks + baseline_wander + noise).tolist()[:2500]

    with open("sample_normal.json", "w") as f:
        json.dump({"signal": final_signal}, f)

    print("File Generated: sample_normal.json")
    print("--- EXPECTED CLASSIFICATION RESULT ---")
    print("Severity Status: 0 - Normal")
    print("Calculated AF Burden: 0%")
    print("Clinical Meaning: Stable baseline sinus rhythm")


if __name__ == "__main__":
    generate_normal()