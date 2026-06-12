import os
import glob
import sys
import json
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed

# Ensure the parent directory is in the path to import dataset
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from dataset import calculate_severity_from_atr

def process_single_file(path):
    try:
        # Resolve relative path consistent with main dataset references
        rel_path = os.path.relpath(path, start=os.getcwd())
        label = calculate_severity_from_atr(path)
        return rel_path, int(label)
    except Exception:
        # Fallback to normal if any annotation reading error occurs
        rel_path = os.path.relpath(path, start=os.getcwd())
        return rel_path, 0

def build_cache():
    print("Searching for local patient records in physionet_data_aws...")
    absolute_target = './physionet_data_aws/p0*/*/*.dat'
    patient_files = [f.replace('.dat', '') for f in glob.glob(absolute_target)]
    
    if len(patient_files) == 0:
        # Fallback if run from root
        absolute_target = './ml_pipeline/physionet_data_aws/p0*/*/*.dat'
        patient_files = [f.replace('.dat', '') for f in glob.glob(absolute_target)]
        
    print(f"Found {len(patient_files)} files to scan.")
    if len(patient_files) == 0:
        return

    cache_data = {}
    class_counts = Counter()
    
    # Utilize multicore parallelism for high-speed indexing (Ryzen 7 5700X has 16 threads)
    max_workers = os.cpu_count() or 4
    print(f"Starting parallel annotation scan using {max_workers} processes...")
    
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        futures = {executor.submit(process_single_file, path): path for path in patient_files}
        
        for i, future in enumerate(as_completed(futures)):
            rel_path, label = future.result()
            cache_data[rel_path] = label
            class_counts[label] += 1
            
            if (i + 1) % 2000 == 0:
                print(f"Scanned {i + 1}/{len(patient_files)} records...")

    # Save cache file
    cache_path = os.path.join(os.path.dirname(__file__), "metadata_cache.json")
    with open(cache_path, "w") as f:
        json.dump(cache_data, f, indent=4)
        
    print(f"\nSuccess: Metadata cache built and saved to {cache_path}")
    print("\n--- CLASS DISTRIBUTION ---")
    total = len(patient_files)
    for cls in sorted(class_counts.keys()):
        count = class_counts[cls]
        pct = (count / total) * 100
        print(f"Class {cls}: {count} records ({pct:.2f}%)")

if __name__ == "__main__":
    build_cache()
