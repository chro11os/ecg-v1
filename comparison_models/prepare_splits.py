import os
import sys
import json
import random

# Add parent directory to path to locate ml_pipeline
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def prepare_splits():
    # Load metadata cache
    cache_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ml_pipeline/metadata_cache.json"))
    if not os.path.exists(cache_path):
        print(f"Error: metadata_cache.json not found at {cache_path}. Run build_metadata_cache.py first.")
        return

    with open(cache_path, "r") as f:
        cache_data = json.load(f)

    # Group files by class
    class_groups = {0: [], 1: [], 2: [], 3: []}
    for rel_path, label in cache_data.items():
        # Build absolute path to verify file existence locally
        abs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", rel_path))
        if os.path.exists(abs_path + ".dat"):
            class_groups[label].append(rel_path)

    print("--- DATASET STATS ---")
    for cls, files in class_groups.items():
        print(f"Class {cls}: {len(files)} records")

    # Generate Train (70%), Val (15%), Test (15%) patient-wise split
    train_files = []
    val_files = []
    test_files = []

    random.seed(42)  # Secure reproducibility seed matching thesis setup

    for cls, files in class_groups.items():
        random.shuffle(files)
        total = len(files)
        tr_count = int(0.70 * total)
        val_count = int(0.15 * total)

        cls_train = files[:tr_count]
        cls_val = files[tr_count:tr_count+val_count]
        cls_test = files[tr_count+val_count:]

        val_files.extend(cls_val)
        test_files.extend(cls_test)

        # Balance training split (RUS class 0, ROS classes 1, 2, 3)
        if len(cls_train) > 0:
            target_samples = 1000
            if cls == 0:
                cls_train_balanced = random.sample(cls_train, min(target_samples, len(cls_train)))
            else:
                cls_train_balanced = [random.choice(cls_train) for _ in range(target_samples)]
            train_files.extend(cls_train_balanced)

    # Shuffle training files to mix classes in batch loading
    random.shuffle(train_files)

    # Save split layout to disk
    layout = {
        "train": train_files,
        "val": val_files,
        "test": test_files
    }

    output_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(output_dir, exist_ok=True)
    layout_path = os.path.join(output_dir, "split_layout.json")

    with open(layout_path, "w") as f:
        json.dump(layout, f, indent=4)

    print(f"\nSuccess: Split indices saved to {layout_path}")
    print(f"Balanced Train: {len(train_files)} records")
    print(f"Validation: {len(val_files)} records")
    print(f"Testing: {len(test_files)} records")

if __name__ == "__main__":
    prepare_splits()
