from __future__ import annotations

import json
import math
import inspect
import threading
import time
import gc
import os
from pathlib import Path
from typing import Any
import urllib.error
import urllib.request
from urllib.parse import quote

import numpy as np

from .bm25 import BM25Index
from .confidence import apply_confidence, label_for
from .config import PROJECT_ROOT, settings
from .config import RERANKER_MODEL_PRESETS
from .dense import EmbeddingModel
from .fusion import rank_map, reciprocal_rank_fusion, score_map
from .html_fragments import HtmlFragmentProvider
from .indexer import ensure_index
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


def _bounded(value: float) -> float:
    return max(0.0, min(1.0, value))


def _compact_error_body(body: bytes, limit: int = 420) -> str:
    text = body.decode("utf-8", errors="replace").strip()
    return text[:limit] + ("..." if len(text) > limit else "")


def _read_secret_file(path: Path) -> str:
    try:
        return path.expanduser().read_text(encoding="utf-8").strip()
    except OSError:
        return ""


class SearchEngine:
    def __init__(self, index_dir: Path | None = None):
        self.index_dir = index_dir or settings.index_dir
        ensure_index(index_dir=self.index_dir)
        self.chunks = load_chunks(self.index_dir / "chunks.jsonl")
        self.embeddings = np.load(self.index_dir / "embeddings.npy").astype(np.float32)
        self.bm25 = BM25Index([chunk.text for chunk in self.chunks])
        self.embedder = EmbeddingModel(settings.embedding_model)
        self.fragments = HtmlFragmentProvider(settings.source_dir)
        self._rerankers: dict[str, Any] = {}
        self._reranker_lock = threading.Lock()
        self.reranker_errors: dict[str, str] = {}
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
            "default_reranker_model": self._default_reranker_key(),
            "reranker_models": [
                {"key": key, **preset}
                for key, preset in RERANKER_MODEL_PRESETS.items()
            ],
            "reranker_loaded": bool(self._rerankers),
            "loaded_reranker_models": list(self._rerankers.keys()),
            "reranker_errors": self.reranker_errors,
            "azure_foundry_local_key_configured": bool(
                self._local_azure_foundry_config().get("api_key")
            ),
            "metadata": self.metadata,
        }

    def _default_reranker_key(self) -> str:
        if settings.default_reranker_key in RERANKER_MODEL_PRESETS:
            return settings.default_reranker_key
        return "jina"

    def _resolve_reranker_model(self, model_key: str | None) -> tuple[str, str]:
        key = model_key if model_key in RERANKER_MODEL_PRESETS else self._default_reranker_key()
        return key, RERANKER_MODEL_PRESETS[key]["model"]

    def _is_external_reranker(self, model_key: str) -> bool:
        return RERANKER_MODEL_PRESETS[model_key].get("external") == "azure_foundry"

    def _cross_encoder_kwargs(self, cross_encoder_cls: Any, model_key: str) -> dict[str, Any]:
        kwargs = dict(RERANKER_MODEL_PRESETS[model_key].get("cross_encoder_kwargs", {}))
        signature = inspect.signature(cross_encoder_cls.__init__)
        parameters = signature.parameters
        if "model_kwargs" not in parameters and "model_kwargs" in kwargs:
            model_kwargs = kwargs.pop("model_kwargs")
            if "automodel_args" in parameters:
                kwargs["automodel_args"] = model_kwargs
        return {key: value for key, value in kwargs.items() if key in parameters}

    def _normalize_reranker_score(self, model_key: str, raw_value: float) -> float:
        if RERANKER_MODEL_PRESETS[model_key].get("score_transform") == "identity":
            return _bounded(raw_value)
        return _sigmoid(raw_value)

    def _azure_foundry_url(self, endpoint: str, request_format: str) -> str:
        endpoint = endpoint.strip()
        if not endpoint:
            raise ValueError("Azure Foundry endpoint is required.")
        lowered = endpoint.rstrip("/").lower()
        if lowered.endswith("/rerank"):
            return endpoint.rstrip("/")
        if request_format == "cohere":
            return endpoint.rstrip("/") + "/v2/rerank"
        return endpoint.rstrip("/") + "/rerank"

    def _azure_foundry_headers(self, api_key: str, auth_type: str) -> dict[str, str]:
        api_key = api_key.strip()
        if not api_key:
            raise ValueError("Azure Foundry API key or token is required.")
        headers = {"Content-Type": "application/json"}
        auth_type = (auth_type or "bearer").strip().lower()
        if auth_type == "api-key":
            headers["api-key"] = api_key
        elif auth_type == "x-api-key":
            headers["x-api-key"] = api_key
        else:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    def _local_azure_foundry_config(self) -> dict[str, str]:
        config: dict[str, str] = {}
        local_config_path = Path(
            os.getenv(
                "IMAC_AZURE_FOUNDRY_CONFIG",
                str(PROJECT_ROOT / "config" / "azure_foundry.local.json"),
            )
        )
        if local_config_path.exists():
            try:
                payload = json.loads(local_config_path.read_text(encoding="utf-8"))
                if isinstance(payload, dict):
                    for key in ("endpoint", "api_key", "request_format", "auth_type", "model"):
                        value = payload.get(key)
                        if value:
                            config[key] = str(value)
            except (OSError, json.JSONDecodeError):
                pass

        key_file = os.getenv(
            "IMAC_AZURE_FOUNDRY_KEY_FILE",
            str(PROJECT_ROOT / "config" / "azure_foundry.key"),
        )
        file_key = _read_secret_file(Path(key_file))
        if file_key:
            config["api_key"] = file_key
        env_key = os.getenv("IMAC_AZURE_FOUNDRY_API_KEY", "").strip()
        if env_key:
            config["api_key"] = env_key

        for env_name, config_key in (
            ("IMAC_AZURE_FOUNDRY_ENDPOINT", "endpoint"),
            ("IMAC_AZURE_FOUNDRY_REQUEST_FORMAT", "request_format"),
            ("IMAC_AZURE_FOUNDRY_AUTH_TYPE", "auth_type"),
            ("IMAC_AZURE_FOUNDRY_MODEL", "model"),
        ):
            value = os.getenv(env_name, "").strip()
            if value:
                config[config_key] = value
        return config

    def _azure_foundry_config(self, request_config: dict[str, Any] | None) -> dict[str, Any]:
        config: dict[str, Any] = self._local_azure_foundry_config()
        for key, value in (request_config or {}).items():
            if value not in (None, ""):
                config[key] = value
        return config

    def _azure_foundry_payload(
        self,
        query: str,
        documents: list[str],
        config: dict[str, Any],
    ) -> tuple[str, bytes]:
        request_format = str(config.get("request_format") or "tei").strip().lower()
        if request_format not in {"tei", "cohere"}:
            request_format = "tei"
        endpoint = self._azure_foundry_url(str(config.get("endpoint") or ""), request_format)
        if request_format == "cohere":
            payload = {
                "model": str(config.get("model") or "model"),
                "query": query,
                "documents": documents,
                "top_n": len(documents),
            }
        else:
            payload = {
                "query": query,
                "texts": documents,
                "raw_scores": False,
                "return_text": False,
            }
        return endpoint, json.dumps(payload, ensure_ascii=False).encode("utf-8")

    def _parse_azure_foundry_scores(self, payload: Any, count: int) -> list[float]:
        if count <= 0:
            return []
        scores = [0.0 for _ in range(count)]
        seen = [False for _ in range(count)]
        items = payload
        if isinstance(payload, dict):
            if isinstance(payload.get("results"), list):
                items = payload["results"]
            elif isinstance(payload.get("data"), list):
                items = payload["data"]
            elif isinstance(payload.get("rankings"), list):
                items = payload["rankings"]
            elif isinstance(payload.get("scores"), list):
                items = payload["scores"]
        if not isinstance(items, list):
            raise ValueError("Azure Foundry response did not include a score list.")

        for position, item in enumerate(items):
            index = position
            score = None
            if isinstance(item, (int, float)):
                score = float(item)
            elif isinstance(item, dict):
                raw_index = item.get("index", item.get("document_index", position))
                try:
                    index = int(raw_index)
                except (TypeError, ValueError):
                    index = position
                for key in ("score", "relevance_score", "rerank_score", "rank_score"):
                    if key in item:
                        score = float(item[key])
                        break
            if score is None or index < 0 or index >= count:
                continue
            scores[index] = score
            seen[index] = True

        if not any(seen):
            raise ValueError("Azure Foundry response did not contain usable scores.")
        return scores

    def _azure_foundry_scores(
        self,
        query: str,
        documents: list[str],
        config: dict[str, Any] | None,
    ) -> list[float]:
        config = self._azure_foundry_config(config)
        endpoint, body = self._azure_foundry_payload(query, documents, config)
        headers = self._azure_foundry_headers(
            str(config.get("api_key") or ""),
            str(config.get("auth_type") or "bearer"),
        )
        timeout = max(5, min(180, int(config.get("timeout_seconds") or 90)))
        request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = _compact_error_body(exc.read())
            raise RuntimeError(f"Azure Foundry request failed: HTTP {exc.code}. {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Azure Foundry request failed: {exc.reason}") from exc
        return self._parse_azure_foundry_scores(response_payload, len(documents))

    def _clear_rerankers(self) -> None:
        self._rerankers.clear()
        self._release_temporary_model_memory()

    def _release_temporary_model_memory(self) -> None:
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

    def _reranker_document(self, result: SearchResult, include_title_context: bool = False) -> str:
        chunk = result.chunk
        if not include_title_context:
            return chunk.text
        parent_path = " > ".join(chunk.section_path[:-1])
        lines = []
        if chunk.section_label:
            heading_kind = "Table heading" if chunk.section_label.lower().startswith("table") else "Section heading"
            lines.append(f"{heading_kind}: {chunk.section_label}")
        if parent_path:
            lines.append(f"Section path: {parent_path}")
        elif chunk.section_path:
            lines.append(f"Section path: {' > '.join(chunk.section_path)}")
        if chunk.chapter_title:
            lines.append(f"Chapter: {chunk.chapter_title}")
        return "\n".join(lines) + "\n\n" + chunk.text

    def _get_reranker(self, model_key: str):
        key, model_name = self._resolve_reranker_model(model_key)
        if self._is_external_reranker(key):
            return key, model_name, None
        if key in self._rerankers:
            return key, model_name, self._rerankers[key]
        if self._rerankers:
            self._clear_rerankers()
        try:
            from sentence_transformers import CrossEncoder

            self._rerankers[key] = CrossEncoder(
                model_name,
                **self._cross_encoder_kwargs(CrossEncoder, key),
            )
            self.reranker_errors.pop(key, None)
            return key, model_name, self._rerankers[key]
        except Exception as exc:
            self.reranker_errors[key] = str(exc)
            return key, model_name, None

    def search(
        self,
        query: str,
        top_k: int = 8,
        rerank: bool = True,
        reranker_model: str | None = None,
        include_title_context: bool = False,
        azure_foundry: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        started = time.time()
        query = query.strip()
        top_k = max(1, min(25, int(top_k)))
        reranker_key, reranker_model_name = self._resolve_reranker_model(reranker_model)
        if not tokenize(query):
            return {
                "query": query,
                "top_k": top_k,
                "rerank": rerank,
                "include_title_context": include_title_context,
                "reranker_model": reranker_key,
                "reranker_model_name": reranker_model_name,
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
            documents = [
                self._reranker_document(result, include_title_context)
                for result in results
            ]
            raw_scores = []
            reranker_available = False
            with self._reranker_lock:
                if self._is_external_reranker(reranker_key):
                    try:
                        raw_scores = self._azure_foundry_scores(query, documents, azure_foundry)
                        reranker_available = True
                        self.reranker_errors.pop(reranker_key, None)
                    except Exception as exc:  # noqa: BLE001 - external provider failures should fall back to RRF.
                        self.reranker_errors[reranker_key] = str(exc)
                else:
                    pairs = [[query, document] for document in documents]
                    reranker_key, reranker_model_name, reranker = self._get_reranker(reranker_key)
                    raw_scores = reranker.predict(pairs, show_progress_bar=False) if reranker is not None else []
                    reranker_available = reranker is not None
                    self._release_temporary_model_memory()
            if reranker_available:
                for result, raw in zip(results, raw_scores):
                    raw_value = float(raw)
                    result.reranker_score = raw_value
                    result.reranker_norm = self._normalize_reranker_score(reranker_key, raw_value)
                    result.final_score = 0.80 * result.reranker_norm + 0.20 * result.rrf_score
                results.sort(key=lambda item: item.final_score, reverse=True)
            else:
                warnings.append(
                    f"{reranker_key} reranker unavailable; used RRF ranking. "
                    f"{self.reranker_errors.get(reranker_key)}"
                )
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
            "include_title_context": include_title_context,
            "reranker_model": reranker_key,
            "reranker_model_name": reranker_model_name,
            "query_confidence": round(query_confidence, 4),
            "query_confidence_label": label_for(query_confidence),
            "results": api_results,
            "warnings": warnings,
            "elapsed_ms": round((time.time() - started) * 1000),
        }
