import json
import os
import random
import sys

import wfdb

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_pipeline.dataset import PROJECT_ROOT, afib_fraction, load_cache, patient_split

STRIP = 2500  # 10 s @ 250 Hz, the length the frontend uploads

# name -> (min, max) annotated AFib fraction inside the strip
TARGETS = {'sinus': (0.0, 0.0), 'paroxysm': (0.2, 0.8), 'afib': (1.0, 1.0)}


def find_strip(records, lo, hi, rng):
    """(path, start, fraction) of a random 10 s strip whose AFib fraction is in [lo, hi]."""
    paths = sorted(records)
    rng.shuffle(paths)
    for path in paths:
        meta = records[path]
        # Look around AFib episodes for paroxysm/afib strips; anywhere for sinus
        if hi > 0:
            candidates = [s + d for s, e in meta['afib'] for d in range(-STRIP, e - s, STRIP // 2)]
        else:
            candidates = [rng.randrange(0, meta['sig_len'] - STRIP) for _ in range(5)]
        for start in candidates:
            if 0 <= start <= meta['sig_len'] - STRIP:
                frac = afib_fraction(start, start + STRIP, meta['afib'])
                if lo <= frac <= hi:
                    return path, start, frac
    return None


if __name__ == '__main__':
    # Only test-split patients, so demo strips were never seen in training
    test_records = patient_split(load_cache())['test']
    rng = random.Random(101)
    out_dir = os.path.join(PROJECT_ROOT, 'test')
    os.makedirs(out_dir, exist_ok=True)

    for name, (lo, hi) in TARGETS.items():
        found = find_strip(test_records, lo, hi, rng)
        if found is None:
            print(f"No {name} strip found")
            continue
        path, start, frac = found
        signal = wfdb.rdrecord(path, sampfrom=start, sampto=start + STRIP).p_signal[:, 0].tolist()
        out = os.path.join(out_dir, f"real_{name}.json")
        with open(out, 'w') as f:
            json.dump({'signal': signal, 'source': os.path.basename(path), 'start_sample': start,
                       'annotated_afib_fraction': round(frac, 3)}, f)
        print(f"{name}: {os.path.basename(path)} @ {start} ({100 * frac:.0f}% AFib) -> {out}")
