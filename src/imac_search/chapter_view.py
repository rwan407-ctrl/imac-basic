from __future__ import annotations

import json
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

from .html_fragments import HtmlFragmentProvider, _safe_url
from .models import Chunk
from .text import tokenize


VIEWER_STYLE = """
<style>
.imac-hit-section {
  position: relative !important;
  outline: 6px solid #ffd84d !important;
  outline-offset: 8px !important;
  border-radius: 6px !important;
  background: rgba(255, 236, 97, 0.18) !important;
  box-shadow: 0 0 0 9999px rgba(255, 255, 255, 0.12) !important;
  scroll-margin-top: 32px !important;
}
.imac-hit-banner {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.4rem !important;
  margin: 0.25rem 0 1rem !important;
  padding: 0.45rem 0.75rem !important;
  border: 1px solid #e0b400 !important;
  border-radius: 6px !important;
  background: #fff1a6 !important;
  color: #3f3200 !important;
  font: 700 0.875rem/1.3 system-ui, sans-serif !important;
}
mark.imac-hit-term {
  border-radius: 3px !important;
  padding: 0 0.08em !important;
  background: #ffdf4d !important;
  color: inherit !important;
}
a.external {
  display: inline !important;
}
a.external svg.external-link,
svg.custom__icon.external-link {
  display: inline-block !important;
  width: 0.82em !important;
  min-width: 0.82em !important;
  max-width: 0.82em !important;
  height: 0.82em !important;
  margin-left: 0.16em !important;
  vertical-align: -0.08em !important;
}
</style>
"""


def _nearest_container(heading: Tag | None) -> Tag | None:
    if heading is None:
        return None
    details = heading.find_parent("details")
    if details is not None:
        return details
    sibling = heading.find_next_sibling()
    while sibling is not None:
        if isinstance(sibling, Tag) and sibling.name == "details":
            return sibling
        if isinstance(sibling, Tag) and sibling.name in {"h1", "h2", "h3", "h4"}:
            break
        sibling = sibling.find_next_sibling()
    return heading


def _add_banner(soup: BeautifulSoup, container: Tag, chunk: Chunk) -> None:
    banner = soup.new_tag("div")
    banner["class"] = "imac-hit-banner"
    banner.string = f"Retrieved chunk: {chunk.chunk_id}"
    if container.name == "details" and container.summary:
        container.summary.insert_after(banner)
    else:
        container.insert(0, banner)


def _mark_revealed_target(container: Tag) -> None:
    container["id"] = "imac-hit-section"
    if container.name == "details":
        container["open"] = ""

    parent = container.find_parent("details")
    while parent is not None:
        parent["open"] = ""
        parent = parent.find_parent("details")


def _highlight_terms(soup: BeautifulSoup, container: Tag, query: str) -> None:
    terms = [term for term in dict.fromkeys(tokenize(query)) if len(term) >= 3]
    if not terms:
        return
    term_set = set(terms)

    for node in list(container.find_all(string=True)):
        if not isinstance(node, NavigableString):
            continue
        parent = node.parent
        if parent is None or parent.name in {"script", "style", "mark"}:
            continue
        text = str(node)
        tokens = tokenize(text)
        if not any(token in term_set for token in tokens):
            continue

        pieces: list[str | Tag] = []
        cursor = 0
        lower = text.lower()
        spans: list[tuple[int, int]] = []
        for term in terms:
            start = 0
            needle = term.lower()
            while True:
                idx = lower.find(needle, start)
                if idx == -1:
                    break
                before = lower[idx - 1] if idx > 0 else " "
                after_idx = idx + len(needle)
                after = lower[after_idx] if after_idx < len(lower) else " "
                if not before.isalnum() and not after.isalnum():
                    spans.append((idx, after_idx))
                start = after_idx
        if not spans:
            continue

        spans = sorted(spans)
        merged: list[tuple[int, int]] = []
        for start, end in spans:
            if merged and start <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))

        for start, end in merged:
            if start > cursor:
                pieces.append(text[cursor:start])
            mark = soup.new_tag("mark")
            mark["class"] = "imac-hit-term"
            mark.string = text[start:end]
            pieces.append(mark)
            cursor = end
        if cursor < len(text):
            pieces.append(text[cursor:])

        for piece in reversed(pieces):
            node.insert_after(piece)
        node.extract()


def _sanitize_full_page(soup: BeautifulSoup) -> None:
    for tag in list(soup.find_all(["script", "noscript", "iframe"])):
        tag.decompose()
    for tag in soup.find_all(True):
        for attr in list(tag.attrs):
            if attr.lower().startswith("on"):
                del tag.attrs[attr]
        for attr in ("href", "src"):
            if tag.get(attr):
                safe = _safe_url(str(tag[attr]))
                if safe:
                    tag[attr] = safe
                else:
                    del tag.attrs[attr]


def render_highlighted_chapter(
    handbook_dir: Path,
    chunk: Chunk,
    query: str = "",
) -> str:
    provider = HtmlFragmentProvider(handbook_dir)
    path = (handbook_dir / chunk.file_name).resolve()
    root = handbook_dir.resolve()
    if not str(path).startswith(str(root)) or not path.exists():
        raise FileNotFoundError(chunk.file_name)

    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "lxml")
    _sanitize_full_page(soup)

    heading = provider._find_best_heading(soup, chunk)
    container = _nearest_container(heading)
    if container is not None:
        existing = container.get("class", [])
        container["class"] = [*existing, "imac-hit-section"]
        _mark_revealed_target(container)
        _add_banner(soup, container, chunk)
        _highlight_terms(soup, container, query)

    if soup.head:
        soup.head.append(BeautifulSoup(VIEWER_STYLE, "html.parser"))

    scroll_script = soup.new_tag("script")
    scroll_script.string = """
window.addEventListener('load', () => {
  const hit = document.getElementById('imac-hit-section') || document.querySelector('.imac-hit-section');
  if (hit) {
    hit.open = true;
    hit.scrollIntoView({ block: 'center' });
  }
});
"""
    if soup.body:
        soup.body.append(scroll_script)

    return str(soup)
