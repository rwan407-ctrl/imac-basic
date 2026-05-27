from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path

import numpy as np

from .config import settings
from .dense import EmbeddingModel
from .ingest import build_chunks, save_chunks


def build_index(source_dir: Path | None = None, index_dir: Path | None = None) -> dict:
    source_dir = source_dir or settings.source_dir
    index_dir = index_dir or settings.index_dir
    index_dir.mkdir(parents=True, exist_ok=True)

    started = time.time()
    chunks = build_chunks(source_dir)
    save_chunks(chunks, index_dir / "chunks.jsonl")

    embedder = EmbeddingModel(settings.embedding_model)
    embeddings = embedder.encode_documents([chunk.text for chunk in chunks])
    np.save(index_dir / "embeddings.npy", embeddings)

    chapter_counts = Counter(chunk.chapter_title for chunk in chunks)
    metadata = {
        "built_at_unix": time.time(),
        "build_seconds": round(time.time() - started, 2),
        "source_dir": str(source_dir),
        "chunk_count": len(chunks),
        "chapter_count": len(chapter_counts),
        "embedding_model": settings.embedding_model,
        "reranker_model": settings.reranker_model,
        "chunk_words": settings.chunk_words,
        "chunk_overlap": settings.chunk_overlap,
        "chapters": dict(sorted(chapter_counts.items())),
    }
    (index_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata

