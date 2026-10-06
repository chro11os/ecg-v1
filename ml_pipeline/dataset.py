import json
import os
import random

import numpy as np
import torch
import wfdb
from torch.utils.data import Dataset

from model import WINDOW, preprocess

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CACHE_PATH = os.path.join(os.path.dirname(__file__), 'metadata_cache.json')


def afib_intervals(record_path):
    """
    [(start, end)] sample ranges annotated as AFib in an Icentia11k .atr file.
    Rhythm notes look like '(AFIB' ... ')' or '(N' ... ')'; beat notes are the string 'None'.
    """
    ann = wfdb.rdann(record_path, 'atr')
    intervals, start = [], None
    for sample, note in zip(ann.sample, ann.aux_note):
        if note.startswith('(AFIB'):
            if start is None:
                start = int(sample)
        elif start is not None and (note.startswith('(') or note.endswith(')')):
            intervals.append((start, int(sample)))
            start = None
    if start is not None:  # episode still running at the end of the segment
        intervals.append((start, wfdb.rdheader(record_path).sig_len))
    return intervals


def afib_fraction(start, end, intervals):
    """Fraction of [start, end) covered by AFib intervals."""
    overlap = sum(max(0, min(end, e) - max(start, s)) for s, e in intervals)
    return overlap / (end - start)


def load_cache():
    """{absolute record path: {'sig_len', 'afib'}} for every cached record present on disk."""
    if not os.path.exists(CACHE_PATH):
        raise SystemExit("metadata_cache.json not found. Run ml_pipeline/build_metadata_cache.py first.")
    with open(CACHE_PATH) as f:
        cache = json.load(f)
    records = {os.path.join(PROJECT_ROOT, rel): meta for rel, meta in cache.items()}
    return {p: m for p, m in records.items() if os.path.exists(p + '.dat')}


def patient_split(records, seed=42):
    """
    70/15/15 split by patient folder (pXXXXX). Each patient's segments stay in one split,
    so the test set never contains a patient the model trained on.
    """
    patient = lambda p: os.path.basename(os.path.dirname(p))
    patients = sorted({patient(p) for p in records})
    random.Random(seed).shuffle(patients)
    a, b = int(0.70 * len(patients)), int(0.85 * len(patients))
    which = {pid: 'train' if i < a else 'val' if i < b else 'test' for i, pid in enumerate(patients)}
    splits = {'train': {}, 'val': {}, 'test': {}}
    for p, meta in records.items():
        splits[which[patient(p)]][p] = meta
    return splits


class ECGWindowDataset(Dataset):
    """
    2 s windows drawn from Icentia11k records. A window is labelled AFib (1) when at least
    half of it lies inside an annotated AFib episode, so the label describes what the model sees.

    windows_per_record random windows keep the natural rhythm mix; afib_windows_per_record extra
    windows are drawn from inside AFib episodes to counter AFib's low prevalence (training only).
    """

    def __init__(self, records, windows_per_record=20, afib_windows_per_record=0, seed=42):
        rng = np.random.default_rng(seed)
        self.windows = []
        for path, meta in sorted(records.items()):
            n, intervals = meta['sig_len'], meta['afib']
            starts = list(rng.integers(0, n - WINDOW + 1, windows_per_record))

            episodes = [(s, e) for s, e in intervals if e - s >= WINDOW]
            if episodes and afib_windows_per_record:
                room = np.array([e - s - WINDOW + 1 for s, e in episodes], dtype=float)
                for k in rng.choice(len(episodes), afib_windows_per_record, p=room / room.sum()):
                    s, e = episodes[k]
                    starts.append(rng.integers(s, e - WINDOW + 1))

            self.windows += [(path, int(s), int(afib_fraction(s, s + WINDOW, intervals) >= 0.5)) for s in starts]

    @property
    def labels(self):
        return np.array([w[2] for w in self.windows])

    def __len__(self):
        return len(self.windows)

    def __getitem__(self, idx):
        path, start, label = self.windows[idx]
        raw = wfdb.rdrecord(path, sampfrom=start, sampto=start + WINDOW).p_signal[:, 0]
        x = torch.from_numpy(preprocess(raw)).unsqueeze(0)  # (1, 500)
        return x, torch.tensor(label, dtype=torch.long)
