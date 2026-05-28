from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.config import RERANKER_MODEL_PRESETS
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


if __name__ == "__main__":
    unittest.main()
