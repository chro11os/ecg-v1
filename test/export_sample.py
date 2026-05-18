import json
import numpy as np

def create_mock_json(filename="sample_ecg.json"):
    signal = np.random.normal(0,1,2500).tolist()

    data = {"signal": signal}

    with open(filename, "w") as f:
        json.dump(data, f)
    print(f"Exported 10s window to {filename}")

if __name__ == "__main__":
    create_mock_json()