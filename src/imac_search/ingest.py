from __future__ import annotations

import csv
import json
from dataclasses import asdict
from pathlib import Path

from bs4 import BeautifulSoup, Tag

from .config import settings
from .models import Chunk
from .text import clean_text, word_count


CONTENT_TAGS = {"p", "li", "table"}
HEADING_TAGS = {"h1", "h2", "h3", "h4"}
DROP_CLASS_PARTS = (
    "breadcrumb",
    "footer",
    "jump",
    "main-nav",
    "nav-",
    "page-actions",
    "site-alert",
    "skip",
)
DROP_TEXT = {
    "on this page",
    "expand all",
    "print",
    "share",
}


def read_manifest(source_dir: Path | None = None) -> list[dict]:
    source_dir = source_dir or settings.source_dir
    manifest_path = source_dir / "MANIFEST.csv"
    with manifest_path.open("r", encoding="utf-8-sig", newline="") as fp:
        rows = list(csv.DictReader(fp))
    for row in rows:
        row["chapter_id"] = int(row["chapter_id"])
        row["title"] = clean_text(row["title"])
        row["url"] = clean_text(row["url"])
        row["filename"] = row["filename"].strip()
    return rows


def _class_text(tag: Tag) -> str:
    if tag.attrs is None:
        return ""
    classes = tag.get("class") or []
    return " ".join(str(c).lower() for c in classes)


def _should_drop(tag: Tag) -> bool:
    if tag.attrs is None:
        return False
    class_text = _class_text(tag)
    if any(part in class_text for part in DROP_CLASS_PARTS):
        return True
    if tag.name in {"script", "style", "noscript", "svg", "nav", "header", "footer", "form"}:
        return True
    return False


def _clean_soup(html: str) -> Tag:
    soup = BeautifulSoup(html, "lxml")
    root = soup.find("main") or soup.body or soup
    for tag in list(root.find_all(True)):
        if _should_drop(tag):
            tag.decompose()
    return root


def _table_text(table: Tag) -> str:
    parts: list[str] = []
    caption = clean_text(table.caption.get_text(" ", strip=True)) if table.caption else ""
    if caption:
        parts.append(f"Table: {caption}")
    for row in table.find_all("tr"):
        cells = [clean_text(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]
        cells = [c for c in cells if c]
        if cells:
            parts.append(" | ".join(cells))
    return clean_text("\n".join(parts))


def _iter_content(root: Tag):
    for tag in root.find_all([*HEADING_TAGS, *CONTENT_TAGS], recursive=True):
        if tag.find_parent("table") and tag.name != "table":
            continue
        text = ""
        if tag.name == "table":
            text = _table_text(tag)
        else:
            text = clean_text(tag.get_text(" ", strip=True))
        if not text or text.lower() in DROP_TEXT:
            continue
        yield tag, text


def _split_words(text: str, size: int, overlap: int) -> list[str]:
    words = text.split()
    if len(words) <= size:
        return [text]
    chunks: list[str] = []
    step = max(1, size - overlap)
    for start in range(0, len(words), step):
        window = words[start : start + size]
        if window:
            chunks.append(" ".join(window))
        if start + size >= len(words):
            break
    return chunks


def _section_label(path: list[str]) -> str:
    if not path:
        return "Body"
    return " > ".join(path[1:] or path)


def chunks_from_html(meta: dict, html: str) -> list[Chunk]:
    root = _clean_soup(html)
    section_path: list[str] = []
    section_anchor = ""
    buffers: list[tuple[list[str], str, list[str]]] = []
    current: list[str] = []

    def flush() -> None:
        nonlocal current
        if current:
            buffers.append((section_path[:], section_anchor, current))
            current = []

    for tag, text in _iter_content(root):
        if tag.name in HEADING_TAGS:
            level = int(tag.name[1])
            if level == 1 and not section_path:
                section_path = [text]
                section_anchor = str(tag.get("id") or "")
                continue
            flush()
            depth = max(1, level - 1)
            section_path = section_path[:depth]
            section_path.append(text)
            if tag.get("id"):
                section_anchor = str(tag.get("id"))
            continue
        current.append(text)
    flush()

    chunks: list[Chunk] = []
    chunk_index = 0
    for path, anchor, parts in buffers:
        section_text = clean_text("\n".join(parts))
        if not section_text:
            continue
        for piece in _split_words(section_text, settings.chunk_words, settings.chunk_overlap):
            if word_count(piece) < settings.min_chunk_words:
                continue
            chunk_id = f"ch{meta['chapter_id']:02d}_c{chunk_index:04d}"
            chunks.append(
                Chunk(
                    chunk_id=chunk_id,
                    chapter_id=int(meta["chapter_id"]),
                    chapter_title=str(meta["title"]),
                    file_name=str(meta["filename"]),
                    source_url=str(meta["url"]),
                    section_path=path,
                    section_label=_section_label(path),
                    anchor=anchor,
                    chunk_index=chunk_index,
                    text=piece,
                )
            )
            chunk_index += 1
    return chunks


def build_chunks(source_dir: Path | None = None) -> list[Chunk]:
    source_dir = source_dir or settings.source_dir
    chunks: list[Chunk] = []
    for meta in read_manifest(source_dir):
        html_path = source_dir / meta["filename"]
        html = html_path.read_text(encoding="utf-8")
        chunks.extend(chunks_from_html(meta, html))
    return chunks


def save_chunks(chunks: list[Chunk], path: Path | None = None) -> None:
    path = path or settings.chunks_path
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fp:
        for chunk in chunks:
            fp.write(json.dumps(asdict(chunk), ensure_ascii=False) + "\n")


def load_chunks(path: Path | None = None) -> list[Chunk]:
    path = path or settings.chunks_path
    chunks: list[Chunk] = []
    with path.open("r", encoding="utf-8") as fp:
        for line in fp:
            chunks.append(Chunk(**json.loads(line)))
    return chunks
