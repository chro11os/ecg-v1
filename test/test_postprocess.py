"""Self-check for the burden post-processing: python test/test_postprocess.py"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from model import afib_windows, burden_tier

lo, hi = 0.1, 0.9

# Long recording: a lone false positive is dropped, a lone miss inside an episode is filled
probs = np.array([lo] * 20 + [hi] * 15 + [lo] + [hi] * 15 + [lo] * 10 + [hi] + [lo] * 20)
mask = afib_windows(probs)
assert mask[20:51].all(), "episode with one missed window should stay whole"
assert not mask[61], "isolated false positive should be removed"
assert mask.sum() == 31

# Long recording: an AFib run shorter than MIN_RUN doesn't count
assert not afib_windows(np.array([lo] * 30 + [hi] * 6 + [lo] * 30)).any()

# Short 10 s strip (5 windows): no minimum run, so a real onset is still measured
assert afib_windows(np.array([lo, lo, lo, hi, hi])).tolist() == [False, False, False, True, True]

assert [burden_tier(b) for b in (0, 0.01, 0.2, 0.7)] == [0, 1, 2, 3]
print("ok")
