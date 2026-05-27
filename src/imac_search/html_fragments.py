from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

from .models import Chunk
from .text import clean_text


HEADING_TAGS = {"h1", "h2", "h3", "h4"}
DROP_TAGS = {"base", "footer", "form", "header", "iframe", "nav", "noscript", "script", "style", "svg"}
ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "dd",
    "details",
    "div",
    "dl",
    "dt",
    "em",
    "figcaption",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "picture",
    "pre",
    "small",
    "source",
    "span",
    "strong",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
}
ALLOWED_ATTRS = {
    "alt",
    "aria-label",
    "class",
    "colspan",
    "href",
    "id",
    "rowspan",
    "src",
    "srcset",
    "title",
}
REMOTE_BASE = "https://web.archive.org/web/20240427233845/https://www.tewhatuora.govt.nz"


def _heading_level(tag: Tag) -> int:
    return int(tag.name[1]) if tag.name in HEADING_TAGS else 99


def _norm(value: str) -> str:
    return clean_text(value).replace("\u200e", "").lower()


def _safe_url(value: str) -> str:
    value = value.strip()
    lower = value.lower()
    if lower.startswith(("javascript:", "data:", "vbscript:")):
        return ""
    if value.startswith("/"):
        return f"{REMOTE_BASE}{value}"
    return value


def _safe_srcset(value: str) -> str:
    parts: list[str] = []
    for item in value.split(","):
        bits = item.strip().split()
        if not bits:
            continue
        bits[0] = _safe_url(bits[0])
        if bits[0]:
            parts.append(" ".join(bits))
    return ", ".join(parts)


def _sanitize_fragment(root: BeautifulSoup | Tag) -> str:
    for tag in list(root.find_all(True)):
        if tag.parent is None:
            continue
        if tag.name in DROP_TAGS:
            tag.decompose()
            continue
        if tag.name not in ALLOWED_TAGS:
            if tag.parent is not None:
                tag.unwrap()
            continue

        attrs = {}
        for key, value in tag.attrs.items():
            if key not in ALLOWED_ATTRS:
                continue
            if key in {"href", "src"}:
                safe = _safe_url(str(value))
                if safe:
                    attrs[key] = safe
                continue
            if key == "srcset":
                safe_srcset = _safe_srcset(str(value))
                if safe_srcset:
                    attrs[key] = safe_srcset
                continue
            attrs[key] = value
        tag.attrs = attrs

        if tag.name == "a" and tag.get("href"):
            tag["target"] = "_blank"
            tag["rel"] = "noreferrer"
        if tag.name == "details":
            tag["open"] = ""

    return "".join(str(child) for child in root.contents)


class HtmlFragmentProvider:
    def __init__(self, handbook_dir: Path):
        self.handbook_dir = handbook_dir

    @lru_cache(maxsize=64)
    def _load_soup(self, file_name: str) -> BeautifulSoup:
        path = (self.handbook_dir / file_name).resolve()
        root = self.handbook_dir.resolve()
        if not str(path).startswith(str(root)) or not path.exists():
            raise FileNotFoundError(file_name)
        return BeautifulSoup(path.read_text(encoding="utf-8"), "lxml")

    def _find_best_heading(self, soup: BeautifulSoup, chunk: Chunk) -> Tag | None:
        headings = list(soup.find_all(HEADING_TAGS))
        labels = [label for label in reversed(chunk.section_path) if label]
        for label in labels:
            target = _norm(label)
            if not target:
                continue
            for heading in headings:
                text = _norm(heading.get_text(" ", strip=True))
                if text == target:
                    return heading

        if chunk.anchor:
            anchor = soup.find(id=chunk.anchor)
            if isinstance(anchor, Tag):
                if anchor.name in HEADING_TAGS:
                    return anchor
                parent_heading = anchor.find_parent(HEADING_TAGS)
                if isinstance(parent_heading, Tag):
                    return parent_heading
                next_heading = anchor.find_next(HEADING_TAGS)
                if isinstance(next_heading, Tag):
                    return next_heading
        return soup.find("h1")

    def _collect_section(self, heading: Tag | None, max_chars: int) -> str:
        if heading is None:
            return ""

        start_level = _heading_level(heading)
        parts: list[str] = [str(heading)]
        total = len(parts[0])
        truncated = False

        for node in heading.next_siblings:
            if isinstance(node, NavigableString):
                continue
            if not isinstance(node, Tag):
                continue
            if node.name in HEADING_TAGS and _heading_level(node) <= start_level:
                break
            if node.name in DROP_TAGS:
                continue
            piece = str(node)
            if total + len(piece) > max_chars:
                truncated = True
                break
            parts.append(piece)
            total += len(piece)

        if truncated:
            parts.append('<p class="fragment-truncated">Section continues in the full local HTML page.</p>')
        return "\n".join(parts)

    def section_html(self, chunk: Chunk, max_chars: int = 30000) -> str:
        try:
            soup = self._load_soup(chunk.file_name)
            heading = self._find_best_heading(soup, chunk)
            fragment = self._collect_section(heading, max_chars=max_chars)
            if not fragment:
                return ""
            fragment_soup = BeautifulSoup(f"<div>{fragment}</div>", "html.parser")
            container = fragment_soup.div or fragment_soup
            return _sanitize_fragment(container)
        except Exception:
            return ""
