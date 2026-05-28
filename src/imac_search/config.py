from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path


def _project_root() -> Path:
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        return Path(bundle_root)
    return Path(__file__).resolve().parents[2]


PROJECT_ROOT = _project_root()
DEFAULT_SOURCE_DIR = PROJECT_ROOT / "static" / "handbook"
DEFAULT_RERANKER_KEY = os.getenv("IMAC_DEFAULT_RERANKER", "jina")
DEFAULT_RERANKER_MODEL = os.getenv(
    "IMAC_RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
)
RERANKER_MODEL_PRESETS = {
    "default": {
        "label": "Default",
        "description": "Fast local reranker",
        "model": DEFAULT_RERANKER_MODEL,
        "score_transform": "sigmoid",
    },
    "strong": {
        "label": "Stronger",
        "description": "Larger local reranker",
        "model": os.getenv(
            "IMAC_STRONG_RERANKER_MODEL",
            "cross-encoder/ms-marco-MiniLM-L-12-v2",
        ),
        "score_transform": "sigmoid",
    },
    "jina": {
        "label": "Strongest (Jina)",
        "description": "Jina AI multilingual local reranker",
        "model": os.getenv(
            "IMAC_JINA_RERANKER_MODEL",
            "jinaai/jina-reranker-v2-base-multilingual",
        ),
        "score_transform": "identity",
        "cross_encoder_kwargs": {
            "trust_remote_code": True,
            "max_length": 1024,
            "model_kwargs": {
                "dtype": "auto",
            },
        },
    },
}


@dataclass(frozen=True)
class Settings:
    source_dir: Path = Path(os.getenv("IMAC_HTML_DIR", str(DEFAULT_SOURCE_DIR)))
    index_dir: Path = Path(
        os.getenv("IMAC_INDEX_DIR", str(PROJECT_ROOT / "data" / "index"))
    )
    embedding_model: str = os.getenv(
        "IMAC_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )
    reranker_model: str = os.getenv(
        "IMAC_RERANKER_MODEL", DEFAULT_RERANKER_MODEL
    )
    default_reranker_key: str = DEFAULT_RERANKER_KEY
    chunk_words: int = int(os.getenv("IMAC_CHUNK_WORDS", "260"))
    chunk_overlap: int = int(os.getenv("IMAC_CHUNK_OVERLAP", "45"))
    min_chunk_words: int = int(os.getenv("IMAC_MIN_CHUNK_WORDS", "12"))
    sparse_pool: int = int(os.getenv("IMAC_SPARSE_POOL", "80"))
    dense_pool: int = int(os.getenv("IMAC_DENSE_POOL", "80"))
    fusion_pool: int = int(os.getenv("IMAC_FUSION_POOL", "50"))
    rrf_k: int = int(os.getenv("IMAC_RRF_K", "60"))

    @property
    def chunks_path(self) -> Path:
        return self.index_dir / "chunks.jsonl"

    @property
    def embeddings_path(self) -> Path:
        return self.index_dir / "embeddings.npy"

    @property
    def metadata_path(self) -> Path:
        return self.index_dir / "metadata.json"


settings = Settings()
