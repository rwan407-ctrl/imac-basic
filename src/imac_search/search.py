from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import numpy as np

from .bm25 import BM25Index
from .confidence import apply_confidence, label_for
from .config import settings
from .dense import EmbeddingModel
from .fusion import rank_map, reciprocal_rank_fusion, score_map
from .html_fragments import HtmlFragmentProvider
from .ingest import load_chunks
from .models import SearchResult
from .text import make_snippet, tokenize


def _top_from_scores(scores: np.ndarray, k: int) -> list[tuple[int, float]]:
    if len(scores) == 0:
        return []
    k = min(k, len(scores))
    idx = np.argpartition(-scores, range(k))[:k]
    ordered = idx[np.argsort(-scores[idx])]
    return [(int(i), float(scores[i])) for i in ordered if scores[i] > 0.0]


def _sigmoid(value: float) -> float:
    if value >= 0:
        z = math.exp(-value)
        return 1.0 / (1.0 + z)
    z = math.exp(value)
    return z / (1.0 + z)


class SearchEngine:
    def __init__(self, index_dir: Path | None = None):
        self.index_dir = index_dir or settings.index_dir
        self.chunks = load_chunks(self.index_dir / "chunks.jsonl")
        self.embeddings = np.load(self.index_dir / "embeddings.npy").astype(np.float32)
        self.bm25 = BM25Index([chunk.text for chunk in self.chunks])
        self.embedder = EmbeddingModel(settings.embedding_model)
        self.fragments = HtmlFragmentProvider(settings.source_dir)
        self._reranker = None
        self.reranker_error: str | None = None
        self.metadata = self._load_metadata()

    def _load_metadata(self) -> dict[str, Any]:
        path = self.index_dir / "metadata.json"
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def stats(self) -> dict[str, Any]:
        return {
            "ready": True,
            "chunk_count": len(self.chunks),
            "chapter_count": len({c.chapter_id for c in self.chunks}),
            "source_dir": self.metadata.get("source_dir", str(settings.source_dir)),
            "embedding_model": settings.embedding_model,
            "reranker_model": settings.reranker_model,
            "reranker_loaded": self._reranker is not None,
            "reranker_error": self.reranker_error,
            "metadata": self.metadata,
        }

    def _get_reranker(self):
        if self._reranker is not None:
            return self._reranker
        try:
            from sentence_transformers import CrossEncoder

            self._reranker = CrossEncoder(settings.reranker_model)
            self.reranker_error = None
            return self._reranker
        except Exception as exc:
            self.reranker_error = str(exc)
            return None

    def search(self, query: str, top_k: int = 8, rerank: bool = True) -> dict[str, Any]:
        started = time.time()
        query = query.strip()
        top_k = max(1, min(25, int(top_k)))
        if not tokenize(query):
            return {
                "query": query,
                "top_k": top_k,
                "rerank": rerank,
                "query_confidence": 0.0,
                "query_confidence_label": "low",
                "results": [],
                "warnings": ["Query has no searchable terms."],
                "elapsed_ms": 0,
            }

        sparse = self.bm25.top(query, settings.sparse_pool)
        query_vec = self.embedder.encode_query(query)
        dense_scores = self.embeddings @ query_vec
        dense = _top_from_scores(dense_scores, settings.dense_pool)

        sparse_ranks = rank_map(sparse)
        dense_ranks = rank_map(dense)
        sparse_scores = score_map(sparse)
        dense_score_map = score_map(dense)
        rrf_scores = reciprocal_rank_fusion([sparse, dense], settings.rrf_k)
        fused_ids = [
            doc_id
            for doc_id, _score in sorted(rrf_scores.items(), key=lambda item: item[1], reverse=True)[
                : settings.fusion_pool
            ]
        ]

        results = [
            SearchResult(
                chunk=self.chunks[doc_id],
                rrf_score=rrf_scores[doc_id],
                sparse_rank=sparse_ranks.get(doc_id),
                dense_rank=dense_ranks.get(doc_id),
                sparse_score=sparse_scores.get(doc_id),
                dense_score=dense_score_map.get(doc_id),
            )
            for doc_id in fused_ids
        ]

        warnings: list[str] = []
        if rerank and results:
            reranker = self._get_reranker()
            if reranker is not None:
                pairs = [[query, result.chunk.text] for result in results]
                raw_scores = reranker.predict(pairs, show_progress_bar=False)
                for result, raw in zip(results, raw_scores):
                    raw_value = float(raw)
                    result.reranker_score = raw_value
                    result.reranker_norm = _sigmoid(raw_value)
                    result.final_score = 0.80 * result.reranker_norm + 0.20 * result.rrf_score
                results.sort(key=lambda item: item.final_score, reverse=True)
            else:
                warnings.append(f"Reranker unavailable; used RRF ranking. {self.reranker_error}")
                rerank = False

        if not rerank:
            max_rrf = max((r.rrf_score for r in results), default=1.0)
            for result in results:
                result.final_score = result.rrf_score / max_rrf if max_rrf else 0.0
            results.sort(key=lambda item: item.final_score, reverse=True)

        results = results[:top_k]
        apply_confidence(results, settings.rrf_k, max(settings.sparse_pool, settings.dense_pool))
        for result in results:
            result.snippet = make_snippet(result.chunk.text, query)
            result.score_details = {
                **result.score_details,
                "final_score": round(result.final_score, 6),
                "rrf_score": round(result.rrf_score, 6),
                "sparse_rank": result.sparse_rank,
                "dense_rank": result.dense_rank,
                "sparse_score": round(result.sparse_score, 6) if result.sparse_score is not None else None,
                "dense_score": round(result.dense_score, 6) if result.dense_score is not None else None,
                "reranker_score": round(result.reranker_score, 6) if result.reranker_score is not None else None,
                "reranker_norm": round(result.reranker_norm, 6) if result.reranker_norm is not None else None,
            }

        query_confidence = results[0].confidence if results else 0.0
        api_results = []
        for index, result in enumerate(results):
            item = result.to_api_dict()
            item["highlighted_html_url"] = (
                f"/api/chapter?chunk_id={quote(result.chunk.chunk_id)}&q={quote(query)}"
                "#imac-hit-section"
            )
            if index < 5:
                item["section_html"] = self.fragments.section_html(result.chunk)
            else:
                item["section_html"] = ""
            api_results.append(item)

        return {
            "query": query,
            "top_k": top_k,
            "rerank": rerank,
            "query_confidence": round(query_confidence, 4),
            "query_confidence_label": label_for(query_confidence),
            "results": api_results,
            "warnings": warnings,
            "elapsed_ms": round((time.time() - started) * 1000),
        }
