import os
import json
import random
import sys
import wfdb

def extract_sample(test_number, severity):
    # Mapping for severity names to integers
    severity_map = {"normal": 0, "trace": 1, "mild": 2, "severe": 3}
    
    # Standardize input
    if isinstance(severity, str):
        # Allow numeric strings
        if severity.isdigit():
            sev_class = int(severity)
            sev_name = [k for k, v in severity_map.items() if v == sev_class][0]
        else:
            sev_class = severity_map.get(severity.lower())
            sev_name = severity.lower()
    else:
        sev_class = int(severity)
        sev_name = [k for k, v in severity_map.items() if v == sev_class][0]
        
    if sev_class is None:
        raise ValueError("Severity must be 0-3 or 'normal'/'trace'/'mild'/'severe'")

    # Resolve paths relative to the project root
    test_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(test_dir, ".."))
    cache_path = os.path.join(project_root, "ml_pipeline", "metadata_cache.json")
    
    if not os.path.exists(cache_path):
        raise FileNotFoundError(f"Metadata cache not found at {cache_path}. Please run build_metadata_cache.py first.")

    with open(cache_path, "r") as f:
        cache_data = json.load(f)

    # Filter matching files
    matching_files = []
    for rel_path, label in cache_data.items():
        if label == sev_class:
            # Resolve absolute path depending on prefix
            if rel_path.startswith("physionet_data_aws"):
                abs_path = os.path.abspath(os.path.join(project_root, "ml_pipeline", rel_path))
            else:
                abs_path = os.path.abspath(os.path.join(project_root, rel_path))
            
            if os.path.exists(abs_path + ".dat"):
                matching_files.append(abs_path)

    if not matching_files:
        print(f"No local files found for severity: {sev_name} (Class {sev_class})")
        return

    # Select random record and extract
    record_path = random.choice(matching_files)
    
    # Read 2500 samples (10.0 seconds @ 250Hz)
    record = wfdb.rdrecord(record_path, sampfrom=0, sampto=2500)
    signal = record.p_signal[:, 0].astype(float).tolist()

    # Save to test directory
    output_filename = f"{test_number}_{sev_name}.json"
    output_path = os.path.join(test_dir, output_filename)
    
    with open(output_path, "w") as f:
        json.dump({"signal": signal}, f)
        
    print(f"✅ Successfully exported Class {sev_class} ({sev_name.upper()}) sample to: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract_sample.py <testNumber> <severity>")
        print("Example: python extract_sample.py 123 severe")
        sys.exit(1)
        
    t_num = sys.argv[1]
    sev = sys.argv[2]
    extract_sample(t_num, sev)
