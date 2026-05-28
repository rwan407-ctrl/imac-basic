from __future__ import annotations

import os
import sys
import json
from dataclasses import dataclass
from pathlib import Path


def _project_root() -> Path:
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        return Path(bundle_root)
    return Path(__file__).resolve().parents[2]


PROJECT_ROOT = _project_root()
DEFAULT_SOURCE_DIR = PROJECT_ROOT / "static" / "handbook"


def _load_local_api_settings() -> dict[str, str]:
    path = PROJECT_ROOT / "config" / "api_settings.local.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return {str(key): str(value) for key, value in data.items() if value}


LOCAL_API_SETTINGS = _load_local_api_settings()


def _setting(env_name: str, local_key: str, default: str = "") -> str:
    return os.getenv(env_name) or LOCAL_API_SETTINGS.get(local_key, default)


DEFAULT_RERANKER_MODEL = os.getenv(
    "IMAC_RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
)
AZURE_FOUNDRY_ENDPOINT = _setting("IMAC_AZURE_FOUNDRY_ENDPOINT", "azure_foundry_endpoint")
AZURE_FOUNDRY_API_KEY = _setting("IMAC_AZURE_FOUNDRY_API_KEY", "azure_foundry_api_key")
AZURE_FOUNDRY_BEARER_TOKEN = _setting(
    "IMAC_AZURE_FOUNDRY_BEARER_TOKEN",
    "azure_foundry_bearer_token",
)
AZURE_FOUNDRY_MODEL = _setting("IMAC_AZURE_FOUNDRY_MODEL", "azure_foundry_model")
AZURE_FOUNDRY_API_VERSION = _setting(
    "IMAC_AZURE_FOUNDRY_API_VERSION",
    "azure_foundry_api_version",
    "2024-05-01-preview",
)
AZURE_FOUNDRY_CONFIGURED = bool(
    AZURE_FOUNDRY_ENDPOINT
    and AZURE_FOUNDRY_MODEL
    and (AZURE_FOUNDRY_API_KEY or AZURE_FOUNDRY_BEARER_TOKEN)
)
RERANKER_MODEL_PRESETS = {
    "default": {
        "label": "Default",
        "description": "Fast local reranker",
        "model": DEFAULT_RERANKER_MODEL,
        "provider": "local_cross_encoder",
        "configured": True,
    },
    "strong": {
        "label": "Stronger",
        "description": "Larger local reranker",
        "model": os.getenv(
            "IMAC_STRONG_RERANKER_MODEL",
            "cross-encoder/ms-marco-MiniLM-L-12-v2",
        ),
        "provider": "local_cross_encoder",
        "configured": True,
    },
    "azure_foundry": {
        "label": "Azure/API",
        "description": "Optional Azure AI Foundry reranker",
        "model": AZURE_FOUNDRY_MODEL or "not configured",
        "provider": "azure_foundry",
        "configured": AZURE_FOUNDRY_CONFIGURED,
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
    azure_foundry_endpoint: str = AZURE_FOUNDRY_ENDPOINT
    azure_foundry_api_key: str = AZURE_FOUNDRY_API_KEY
    azure_foundry_bearer_token: str = AZURE_FOUNDRY_BEARER_TOKEN
    azure_foundry_model: str = AZURE_FOUNDRY_MODEL
    azure_foundry_api_version: str = AZURE_FOUNDRY_API_VERSION
    azure_foundry_timeout: float = float(os.getenv("IMAC_AZURE_FOUNDRY_TIMEOUT", "90"))
    azure_foundry_candidate_chars: int = int(
        os.getenv("IMAC_AZURE_FOUNDRY_CANDIDATE_CHARS", "900")
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
