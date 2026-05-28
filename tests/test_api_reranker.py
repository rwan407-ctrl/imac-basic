from __future__ import annotations

import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.api_reranker import AzureFoundryReranker, parse_reranker_scores


class ApiRerankerTests(unittest.TestCase):
    def test_parse_scores_object_list(self):
        content = '{"scores":[{"id":1,"score":0.9},{"id":0,"score":0.2}]}'

        self.assertEqual(parse_reranker_scores(content, 3), [0.2, 0.9, 0.0])

    def test_parse_scores_plain_list_and_clamps(self):
        content = "```json\n[1.2, 0.4, -0.5]\n```"

        self.assertEqual(parse_reranker_scores(content, 3), [1.0, 0.4, 0.0])

    def test_url_appends_chat_completion_route_and_api_version(self):
        reranker = AzureFoundryReranker(
            endpoint="https://example.services.ai.azure.com/models",
            model="reranker",
            api_key="secret",
            api_version="2024-05-01-preview",
        )

        self.assertEqual(
            reranker._url(),
            "https://example.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview",
        )


if __name__ == "__main__":
    unittest.main()
