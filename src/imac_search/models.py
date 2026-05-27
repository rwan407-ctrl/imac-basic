from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import quote


@dataclass
class Chunk:
    chunk_id: str
    chapter_id: int
    chapter_title: str
    file_name: str
    source_url: str
    section_path: list[str]
    section_label: str
    anchor: str
    chunk_index: int
    text: str

    @property
    def url(self) -> str:
        return f"{self.source_url}#{self.anchor}" if self.anchor else self.source_url

    @property
    def local_html_url(self) -> str:
        file_name = quote(self.file_name.replace("\\", "/"))
        return f"/handbook/{file_name}#{quote(self.anchor)}" if self.anchor else f"/handbook/{file_name}"

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["url"] = self.url
        d["local_html_url"] = self.local_html_url
        return d


@dataclass
class SearchResult:
    chunk: Chunk
    rrf_score: float
    sparse_rank: int | None = None
    dense_rank: int | None = None
    sparse_score: float | None = None
    dense_score: float | None = None
    reranker_score: float | None = None
    reranker_norm: float | None = None
    final_score: float = 0.0
    confidence: float = 0.0
    confidence_label: str = "low"
    snippet: str = ""
    score_details: dict[str, Any] = field(default_factory=dict)

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "chunk_id": self.chunk.chunk_id,
            "chapter_id": self.chunk.chapter_id,
            "chapter_title": self.chunk.chapter_title,
            "section": self.chunk.section_label,
            "section_path": self.chunk.section_path,
            "url": self.chunk.url,
            "local_html_url": self.chunk.local_html_url,
            "snippet": self.snippet,
            "confidence": round(self.confidence, 4),
            "confidence_label": self.confidence_label,
            "scores": self.score_details,
        }
