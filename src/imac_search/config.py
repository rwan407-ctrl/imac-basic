from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE_DIR = PROJECT_ROOT / "static" / "handbook"


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
        "IMAC_RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
    )
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
