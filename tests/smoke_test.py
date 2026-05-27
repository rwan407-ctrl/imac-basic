from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.config import settings
from imac_search.indexer import build_index
from imac_search.search import SearchEngine


class SmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not settings.chunks_path.exists() or not settings.embeddings_path.exists():
            build_index()
        cls.engine = SearchEngine()

    def assert_query_contains(self, query: str, keywords: list[str]):
        response = self.engine.search(query, top_k=5, rerank=False)
        text = " ".join(r["chapter_title"] + " " + r["section"] + " " + r["snippet"] for r in response["results"]).lower()
        for keyword in keywords:
            self.assertIn(keyword.lower(), text, f"{keyword!r} missing for {query!r}")

    def test_real_queries(self):
        self.assert_query_contains("MMR contraindications during pregnancy", ["mmr", "preg"])
        self.assert_query_contains("anaphylaxis adrenaline dose paediatric", ["anaphylaxis", "adrenaline"])
        self.assert_query_contains("zoster vaccine eligibility older adults", ["zoster"])
        self.assert_query_contains("national immunisation schedule 6 weeks", ["6 weeks"])


if __name__ == "__main__":
    unittest.main()

