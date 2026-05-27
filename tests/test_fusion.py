from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.fusion import reciprocal_rank_fusion


class FusionTests(unittest.TestCase):
    def test_rrf_rewards_cross_branch_agreement(self):
        sparse = [(1, 10.0), (2, 8.0), (3, 1.0)]
        dense = [(2, 0.9), (1, 0.8), (4, 0.7)]
        fused = reciprocal_rank_fusion([sparse, dense], rrf_k=60)
        ordered = sorted(fused.items(), key=lambda item: item[1], reverse=True)
        self.assertEqual(ordered[0][0], 1)
        self.assertEqual(ordered[1][0], 2)
        self.assertGreater(fused[1], fused[3])
        self.assertGreater(fused[2], fused[4])


if __name__ == "__main__":
    unittest.main()

