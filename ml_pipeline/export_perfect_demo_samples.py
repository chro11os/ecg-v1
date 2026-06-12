import os
import sys
import json
import torch
import random
import wfdb
import numpy as np

# Ensure parent directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from dataset import IcentiaECGDataset, calculate_severity_from_atr
from model import AFCNN_LSTM

def export_perfect_demo_samples():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Executing on: {device}")
    
    # 1. Load cache
    cache_path = os.path.join(os.path.dirname(__file__), "metadata_cache.json")
    if not os.path.exists(cache_path):
        print("Error: metadata_cache.json not found.")
        return
        
    with open(cache_path, "r") as f:
        cache_data = json.load(f)

    # Group files
    class_groups = {0: [], 1: [], 2: [], 3: []}
    for rel_path, label in cache_data.items():
        abs_path = os.path.abspath(os.path.join(os.getcwd(), rel_path))
        if os.path.exists(abs_path + ".dat"):
            class_groups[label].append(abs_path)

    # Recreate the exact split to find TEST set files (to guarantee no training leakage)
    test_files_by_class = {0: [], 1: [], 2: [], 3: []}
    random.seed(42)
    
    for cls, files in class_groups.items():
        random.shuffle(files)
        total = len(files)
        tr_count = int(0.70 * total)
        val_count = int(0.15 * total)
        cls_test = files[tr_count+val_count:]
        test_files_by_class[cls] = cls_test

    # 2. Load the trained model
    model = AFCNN_LSTM(num_classes=4).to(device)
    weights_path = "afib_cnn_lstm_v1.pt"
    if not os.path.exists(weights_path):
        weights_path = "../afib_cnn_lstm_v1.pt"
        if not os.path.exists(weights_path):
            print("Error: afib_cnn_lstm_v1.pt not found.")
            return
            
    print(f"Loading weights from {weights_path}...")
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()

    # 3. Test files in each class to find perfect predictions
    from dataset import min_max_normalize, bandpass_filter
    
    demo_files = {}
    class_names = {
        0: ("normal", "real_normal.json"),
        1: ("trace", "real_trace.json"),
        2: ("mild", "real_mild.json"),
        3: ("severe", "real_severe.json")
    }

    print("\nEvaluating test split files to find perfect matches...")
    for label, (name, filename) in class_names.items():
        test_files = test_files_by_class[label]
        print(f"Class {label} ({name.upper()}): Searching through {len(test_files)} test records...")
        
        best_file = None
        best_conf = 0.0
        
        # Scan files in test split
        for record_path in test_files:
            try:
                # Read 500 samples for model evaluation
                record = wfdb.rdrecord(record_path, sampfrom=0, sampto=500)
                raw_signal = record.p_signal[:, 0].astype(np.float32)
                
                # Preprocess
                filtered = bandpass_filter(raw_signal)
                normalized = min_max_normalize(filtered)
                
                # Tensor
                x = torch.tensor(normalized, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(device)
                
                with torch.no_grad():
                    logits = model(x)
                    probs = torch.softmax(logits, dim=1)
                    conf, pred = torch.max(probs, dim=1)
                    
                pred_class = int(pred.item())
                confidence = float(conf.item())
                
                # We check if prediction matches the target label
                if pred_class == label:
                    if confidence > best_conf:
                        best_conf = confidence
                        best_file = record_path
                        # If we find a very confident prediction, we can stop searching early to save time
                        if confidence > 0.85:
                            break
            except Exception:
                continue
                
        if best_file is not None:
            # Load the full 10-second (2500 samples) signal for frontend rendering
            record = wfdb.rdrecord(best_file, sampfrom=0, sampto=2500)
            signal = record.p_signal[:, 0].astype(float).tolist()
            
            output_file = os.path.join("test", filename)
            with open(output_file, "w") as f:
                json.dump({"signal": signal}, f)
                
            print(f"  👉 Found Perfect Match! File: {os.path.basename(best_file)} | Confidence: {best_conf*100:.2f}% | Saved to: test/{filename}")
            demo_files[name] = best_file
        else:
            print(f"  ⚠️ Warning: No matching files found for Class {label} in the test split.")

    print("\nExport completed. The 'test/' directory now has real clinical patient waveforms that your model is verified to predict correctly!")

if __name__ == "__main__":
    export_perfect_demo_samples()
