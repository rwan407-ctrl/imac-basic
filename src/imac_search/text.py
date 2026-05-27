from __future__ import annotations

import html
import re
import unicodedata


TOKEN_RE = re.compile(r"[a-z0-9]+(?:[-/][a-z0-9]+)*", re.IGNORECASE)
SPACE_RE = re.compile(r"\s+")


def clean_text(value: str) -> str:
    value = html.unescape(value)
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("\u00a0", " ")
    value = value.replace("ﬁ", "fi").replace("ﬂ", "fl")
    value = SPACE_RE.sub(" ", value)
    value = re.sub(r"(\d+)\.([A-Za-z])", r"\1. \2", value)
    value = value.replace("influenzaetype", "influenzae type")
    return value.strip()


def tokenize(value: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(clean_text(value))]


def word_count(value: str) -> int:
    return len(tokenize(value))


def make_snippet(text: str, query: str, max_chars: int = 520) -> str:
    cleaned = clean_text(text)
    if len(cleaned) <= max_chars:
        return cleaned

    query_tokens = [re.escape(t) for t in tokenize(query) if len(t) > 2]
    match = None
    if query_tokens:
        pattern = re.compile(r"\b(" + "|".join(query_tokens) + r")\b", re.IGNORECASE)
        match = pattern.search(cleaned)

    if match:
        start = max(0, match.start() - max_chars // 3)
    else:
        start = 0
    end = min(len(cleaned), start + max_chars)
    start = max(0, end - max_chars)

    snippet = cleaned[start:end].strip()
    if start > 0:
        snippet = "... " + snippet
    if end < len(cleaned):
        snippet += " ..."
    return snippet
