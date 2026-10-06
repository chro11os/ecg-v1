import glob
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

import wfdb

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_pipeline.dataset import CACHE_PATH, PROJECT_ROOT, afib_intervals
from model import burden_tier


def scan_record(path):
    """Record length and AFib episodes for one record. Unreadable records are reported and skipped."""
    try:
        return path, {'sig_len': wfdb.rdheader(path).sig_len, 'afib': afib_intervals(path)}
    except Exception as e:
        print(f"Skipping {path}: {e}")
        return path, None


def build_cache():
    pattern = os.path.join(PROJECT_ROOT, 'ml_pipeline', 'physionet_data_aws', 'p0*', '*', '*.dat')
    paths = [f[:-4] for f in glob.glob(pattern)]
    print(f"Found {len(paths)} records. Scanning annotations on {os.cpu_count()} processes...")
    if not paths:
        return

    cache = {}
    with ProcessPoolExecutor() as pool:
        for i, (path, meta) in enumerate(pool.map(scan_record, paths, chunksize=64)):
            if meta is not None:
                cache[os.path.relpath(path, PROJECT_ROOT)] = meta
            if (i + 1) % 2000 == 0:
                print(f"Scanned {i + 1}/{len(paths)}")

    with open(CACHE_PATH, 'w') as f:
        json.dump(cache, f)
    print(f"Saved {len(cache)} records to {CACHE_PATH}")

    # Record-level burden tiers, for reference (the model itself is trained on 2 s windows)
    tiers = [0, 0, 0, 0]
    for m in cache.values():
        tiers[burden_tier(sum(e - s for s, e in m['afib']) / m['sig_len'])] += 1
    for t, count in enumerate(tiers):
        print(f"Tier {t}: {count} records ({100 * count / len(cache):.2f}%)")


if __name__ == '__main__':
    build_cache()
