"""
Download a training subset of Icentia11k from PhysioNet's public AWS mirror (no account needed).

1. Annotations (.hea + .atr, ~32 KB per segment) for every segment of the first N patients
2. Signals (.dat, 2.1 MB per segment) for up to 10 AFib segments per AFib patient and
   3 random segments per other patient; sinus segments are near-duplicates, so more add little

1,000 patients come to ~9.5 GB instead of the full ~1.1 TB. Safe to re-run: existing files are skipped.
"""
import argparse
import os
import random
import sys
import time
import urllib.request
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_pipeline.dataset import afib_intervals

BASE = 'https://physionet-open.s3.amazonaws.com/icentia11k-continuous-ecg/1.0'
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'physionet_data_aws')


def fetch(rel):
    """Download BASE/rel to DATA_DIR/rel unless it already exists. Returns bytes downloaded."""
    dest = os.path.join(DATA_DIR, rel)
    if os.path.exists(dest):
        return 0
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f'{BASE}/{rel}', timeout=60) as r:
                data = r.read()
            with open(dest + '.part', 'wb') as f:
                f.write(data)
            os.replace(dest + '.part', dest)  # never leave a truncated file under the real name
            return len(data)
        except Exception as e:
            if attempt == 2:
                print(f"FAILED {rel}: {e}", flush=True)
                return 0
            time.sleep(2 ** attempt)


def fetch_all(rels, label, workers):
    start, done, nbytes = time.time(), 0, 0
    with ThreadPoolExecutor(workers) as pool:
        for n in pool.map(fetch, rels):
            done += 1
            nbytes += n
            if done % 500 == 0 or done == len(rels):
                elapsed = time.time() - start
                eta = elapsed / done * (len(rels) - done)
                print(f"[{label}] {done}/{len(rels)} files | {nbytes / 1e9:.2f} GB | "
                      f"{nbytes / 1e6 / elapsed:.1f} MB/s | ETA {eta / 60:.1f} min", flush=True)


def has_afib(rel):
    try:
        return rel, bool(afib_intervals(os.path.join(DATA_DIR, rel)))
    except Exception:
        return rel, False


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--patients', type=int, default=1000)
    ap.add_argument('--afib-segments', type=int, default=10, help="segments per AFib patient")
    ap.add_argument('--other-segments', type=int, default=3, help="segments per patient without AFib")
    ap.add_argument('--workers', type=int, default=32)
    args = ap.parse_args()

    patient_dirs = [f"p{pid // 1000:02d}/p{pid:05d}" for pid in range(args.patients)]
    fetch_all([f"{d}/RECORDS" for d in patient_dirs], "index", args.workers)
    segments = {}
    for d in patient_dirs:
        path = os.path.join(DATA_DIR, d, 'RECORDS')
        if os.path.exists(path):
            segments[d] = [f"{d}/{s.strip()}" for s in open(path) if s.strip()]

    all_segments = [s for segs in segments.values() for s in segs]
    fetch_all([f"{s}.{ext}" for s in all_segments for ext in ('hea', 'atr')], "annotations", args.workers)

    with ProcessPoolExecutor() as pool:
        afib = dict(pool.map(has_afib, all_segments, chunksize=64))

    rng = random.Random(0)
    selected, afib_patients = [], 0
    for segs in segments.values():
        with_afib = [s for s in segs if afib[s]]
        if with_afib:
            afib_patients += 1
            selected += rng.sample(with_afib, min(args.afib_segments, len(with_afib)))
        else:
            selected += rng.sample(segs, min(args.other_segments, len(segs)))
    print(f"{len(segments)} patients ({afib_patients} with AFib), {len(all_segments)} segments -> "
          f"downloading signals for {len(selected)} (~{len(selected) * 2.1 / 1000:.1f} GB)", flush=True)

    fetch_all([f"{s}.dat" for s in selected], "signals", args.workers)
    print("Done. Next: python ml_pipeline/build_metadata_cache.py", flush=True)
