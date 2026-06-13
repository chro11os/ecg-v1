import os
import sys
import json
import random
import wfdb
import numpy as np

# Ensure the parent directory is in the path to import model.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def export_real_samples():
    cache_path = os.path.join(os.path.dirname(__file__), "metadata_cache.json")
    if not os.path.exists(cache_path):
        print("Error: metadata_cache.json not found. Please run build_metadata_cache.py first.")
        return
        
    with open(cache_path, "r") as f:
        cache_data = json.load(f)
        
    # Group available files by class
    class_groups = {0: [], 1: [], 2: [], 3: []}
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    for rel_path, label in cache_data.items():
        if rel_path.startswith("physionet_data_aws"):
            abs_path = os.path.abspath(os.path.join(project_root, "ml_pipeline", rel_path))
        else:
            abs_path = os.path.abspath(os.path.join(project_root, rel_path))
            
        if os.path.exists(abs_path + ".dat"):
            class_groups[label].append(abs_path)
            
    # Define where we want to save the real samples
    test_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../test"))
    os.makedirs(test_dir, exist_ok=True)
    
    print("--- EXPORTING REAL CLINICAL TEST FILES ---")
    random.seed(101) # Set seed for reproducibility
    
    exported_files = {}
    
    class_names = {
        0: ("normal", "real_normal.json"),
        1: ("trace", "real_trace.json"),
        2: ("mild", "real_mild.json"),
        3: ("severe", "real_severe.json")
    }
    
    for label, (name, filename) in class_names.items():
        files = class_groups[label]
        if len(files) == 0:
            print(f"Skipping Class {label} ({name}): No files available locally.")
            continue
            
        # Select a random patient file from the group
        record_path = random.choice(files)
        
        try:
            # Read 2500 samples (10.0 seconds @ 250Hz) from the real patient ECG recording
            record = wfdb.rdrecord(record_path, sampfrom=0, sampto=2500)
            signal = record.p_signal[:, 0].astype(float).tolist()
            
            # Format output matching the frontend schema
            output_data = {"signal": signal}
            output_file = os.path.join(test_dir, filename)
            
            with open(output_file, "w") as f:
                json.dump(output_data, f)
                
            print(f"✅ Exported Class {label} ({name.upper()}): {filename} from patient record: {os.path.basename(record_path)}")
            exported_files[name] = output_file
        except Exception as e:
            print(f"❌ Failed to export Class {label} ({name}): {e}")
            
    print("\nAll exported files have been saved in your project's 'test/' directory.")
    print("You can now upload these files to the GUI for a perfect clinical demonstration!")

if __name__ == "__main__":
    export_real_samples()
