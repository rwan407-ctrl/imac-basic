from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.config import RERANKER_MODEL_PRESETS
from imac_search.models import Chunk, SearchResult
from imac_search.search import SearchEngine


class ModernCrossEncoder:
    def __init__(
        self,
        model_name_or_path=None,
        *,
        trust_remote_code=False,
        model_kwargs=None,
        max_length=None,
    ):
        pass


class LegacyCrossEncoder:
    def __init__(
        self,
        model_name=None,
        *,
        trust_remote_code=False,
        automodel_args=None,
        max_length=None,
    ):
        pass


class RerankerPresetTests(unittest.TestCase):
    def setUp(self):
        self.engine = SearchEngine.__new__(SearchEngine)

    def test_jina_preset_is_available_as_strongest(self):
        self.assertIn("jina", RERANKER_MODEL_PRESETS)
        self.assertEqual(RERANKER_MODEL_PRESETS["jina"]["label"], "Strongest (Jina)")
        self.assertTrue(RERANKER_MODEL_PRESETS["jina"]["cross_encoder_kwargs"]["trust_remote_code"])

    def test_extra_local_reranker_presets_are_available(self):
        expected = {
            "fast",
            "electra",
            "bge_base",
            "bge_m3",
            "mixedbread",
            "qwen3_06b",
        }

        self.assertTrue(expected.issubset(RERANKER_MODEL_PRESETS))
        self.assertEqual(
            RERANKER_MODEL_PRESETS["mixedbread"]["model"],
            "mixedbread-ai/mxbai-rerank-base-v2",
        )
        self.assertEqual(
            RERANKER_MODEL_PRESETS["qwen3_06b"]["model"],
            "Qwen/Qwen3-Reranker-0.6B",
        )
        self.assertTrue(RERANKER_MODEL_PRESETS["bge_m3"]["cross_encoder_kwargs"]["trust_remote_code"])

    def test_azure_foundry_api_preset_is_external(self):
        self.assertEqual(
            RERANKER_MODEL_PRESETS["azure_foundry"]["label"],
            "Azure Foundry API",
        )
        self.assertEqual(RERANKER_MODEL_PRESETS["azure_foundry"]["external"], "azure_foundry")
        self.assertEqual(RERANKER_MODEL_PRESETS["azure_foundry"]["score_transform"], "identity")

    def test_jina_is_default_when_model_key_is_omitted(self):
        key, _model = self.engine._resolve_reranker_model(None)

        self.assertEqual(key, "jina")

    def test_jina_kwargs_support_modern_sentence_transformers(self):
        kwargs = self.engine._cross_encoder_kwargs(ModernCrossEncoder, "jina")

        self.assertTrue(kwargs["trust_remote_code"])
        self.assertIn("model_kwargs", kwargs)
        self.assertNotIn("automodel_args", kwargs)

    def test_jina_kwargs_support_legacy_sentence_transformers(self):
        kwargs = self.engine._cross_encoder_kwargs(LegacyCrossEncoder, "jina")

        self.assertTrue(kwargs["trust_remote_code"])
        self.assertIn("automodel_args", kwargs)
        self.assertNotIn("model_kwargs", kwargs)

    def test_jina_scores_are_already_probabilities(self):
        self.assertEqual(self.engine._normalize_reranker_score("jina", 1.3), 1.0)
        self.assertEqual(self.engine._normalize_reranker_score("jina", -0.1), 0.0)
        self.assertAlmostEqual(self.engine._normalize_reranker_score("jina", 0.75), 0.75)

    def test_azure_foundry_scores_are_parsed_by_index(self):
        payload = {
            "results": [
                {"index": 2, "score": 0.7},
                {"index": 0, "relevance_score": 0.9},
            ]
        }

        self.assertEqual(
            self.engine._parse_azure_foundry_scores(payload, 3),
            [0.9, 0.0, 0.7],
        )

    def test_azure_foundry_base_url_gets_rerank_route(self):
        self.assertEqual(
            self.engine._azure_foundry_url("https://example.models.ai.azure.com", "tei"),
            "https://example.models.ai.azure.com/rerank",
        )
        self.assertEqual(
            self.engine._azure_foundry_url("https://example.models.ai.azure.com/rerank", "tei"),
            "https://example.models.ai.azure.com/rerank",
        )

    def test_reranker_document_includes_table_heading_context(self):
        result = SearchResult(
            chunk=Chunk(
                chunk_id="ch31_c0027",
                chapter_id=31,
                chapter_title="Appendix 2: Planning immunisation catch-ups",
                file_name="appendix.html",
                source_url="https://example.test",
                section_path=[
                    "A2.2.3. National Immunisation Schedule catch-up guides",
                    "Table A2.6: Age at presentation: 2 years to under 5 years",
                ],
                section_label="Table A2.6: Age at presentation: 2 years to under 5 years",
                anchor="table-a2-6-age-at-presentation-2-years-to-under-5-years",
                chunk_index=27,
                text="First dose | DTaP-IPV-HepB/Hib | PCV | MMR",
            ),
            rrf_score=0.01,
        )

        document = self.engine._reranker_document(result, include_title_context=True)

        self.assertIn(
            "Table heading: Table A2.6: Age at presentation: 2 years to under 5 years",
            document,
        )
        self.assertIn(
            "Section path: A2.2.3. National Immunisation Schedule catch-up guides",
            document,
        )
        self.assertIn("Chapter: Appendix 2: Planning immunisation catch-ups", document)
        self.assertTrue(document.endswith("First dose | DTaP-IPV-HepB/Hib | PCV | MMR"))

    def test_reranker_document_can_omit_table_heading_context(self):
        result = SearchResult(
            chunk=Chunk(
                chunk_id="ch31_c0027",
                chapter_id=31,
                chapter_title="Appendix 2: Planning immunisation catch-ups",
                file_name="appendix.html",
                source_url="https://example.test",
                section_path=["Table A2.6: Age at presentation: 2 years to under 5 years"],
                section_label="Table A2.6: Age at presentation: 2 years to under 5 years",
                anchor="table-a2-6-age-at-presentation-2-years-to-under-5-years",
                chunk_index=27,
                text="First dose | DTaP-IPV-HepB/Hib | PCV | MMR",
            ),
            rrf_score=0.01,
        )

        self.assertEqual(
            self.engine._reranker_document(result, include_title_context=False),
            "First dose | DTaP-IPV-HepB/Hib | PCV | MMR",
        )


if __name__ == "__main__":
    unittest.main()
