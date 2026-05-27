from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.confidence import apply_confidence, label_for
from imac_search.models import Chunk, SearchResult


def chunk(i: int) -> Chunk:
    return Chunk(
        chunk_id=f"c{i}",
        chapter_id=i,
        chapter_title="Chapter",
        file_name="x.html",
        source_url="https://example.test",
        section_path=["Chapter", "Section"],
        section_label="Section",
        anchor="section",
        chunk_index=i,
        text="MMR pregnancy contraindication text",
    )


class ConfidenceTests(unittest.TestCase):
    def test_label_thresholds(self):
        self.assertEqual(label_for(0.8), "high")
        self.assertEqual(label_for(0.5), "medium")
        self.assertEqual(label_for(0.2), "low")

    def test_high_agreement_scores_above_single_branch(self):
        agreed = SearchResult(chunk(1), rrf_score=0.032, sparse_rank=1, dense_rank=1, final_score=0.9)
        single = SearchResult(chunk(2), rrf_score=0.016, sparse_rank=20, dense_rank=None, final_score=0.2)
        results = [agreed, single]
        apply_confidence(results, rrf_k=60, pool_size=80)
        self.assertGreater(agreed.confidence, single.confidence)
        self.assertEqual(agreed.confidence_label, "high")

    def test_empty_results_are_allowed(self):
        results: list[SearchResult] = []
        apply_confidence(results, rrf_k=60, pool_size=80)
        self.assertEqual(results, [])


if __name__ == "__main__":
    unittest.main()

