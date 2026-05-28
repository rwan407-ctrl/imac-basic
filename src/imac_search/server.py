from __future__ import annotations

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .chapter_view import render_highlighted_chapter
from .config import PROJECT_ROOT, settings
from .search import SearchEngine


STATIC_DIR = PROJECT_ROOT / "static"
ENGINE: SearchEngine | None = None


def get_engine() -> SearchEngine:
    global ENGINE
    if ENGINE is None:
        ENGINE = SearchEngine()
    return ENGINE


def json_bytes(payload, status: int = 200) -> tuple[int, bytes, str]:
    return status, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8"


class Handler(BaseHTTPRequestHandler):
    server_version = "IMACHybridSearch/0.1"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, payload, status: int = 200) -> None:
        self._send(*json_bytes(payload, status))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/health":
            self._send_json({"ok": True, "index_exists": settings.chunks_path.exists() and settings.embeddings_path.exists()})
            return
        if path == "/api/stats":
            try:
                self._send_json(get_engine().stats())
            except Exception as exc:
                self._send_json({"ready": False, "error": str(exc)}, status=503)
            return
        if path == "/api/chapter":
            self._serve_highlighted_chapter(parsed.query)
            return
        self._serve_static(path)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/search":
            self._send_json({"error": "Not found"}, status=404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body or "{}")
            response = get_engine().search(
                str(payload.get("query", "")),
                top_k=int(payload.get("top_k", 8)),
                rerank=bool(payload.get("rerank", True)),
                reranker_model=str(payload.get("reranker_model", settings.default_reranker_key)),
            )
            self._send_json(response)
        except Exception as exc:
            self._send_json({"error": str(exc)}, status=500)

    def _serve_highlighted_chapter(self, query_string: str) -> None:
        params = parse_qs(query_string)
        chunk_id = (params.get("chunk_id") or [""])[0]
        query = (params.get("q") or [""])[0]
        if not chunk_id:
            self._send_json({"error": "chunk_id is required"}, status=400)
            return
        engine = get_engine()
        chunk = next((item for item in engine.chunks if item.chunk_id == chunk_id), None)
        if chunk is None:
            self._send_json({"error": "chunk not found"}, status=404)
            return
        html = render_highlighted_chapter(settings.source_dir, chunk, query=query)
        self._send(200, html.encode("utf-8"), "text/html; charset=utf-8")

    def _serve_static(self, path: str) -> None:
        if path == "/":
            target = STATIC_DIR / "index.html"
        else:
            safe = unquote(path).lstrip("/")
            target = (STATIC_DIR / safe).resolve()
            if not str(target).startswith(str(STATIC_DIR.resolve())):
                self._send_json({"error": "Invalid path"}, status=400)
                return
        if not target.exists() or not target.is_file():
            self._send_json({"error": "Not found"}, status=404)
            return
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self._send(200, target.read_bytes(), content_type)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Serving IMAC hybrid search at http://{args.host}:{args.port}")
    print(f"Index directory: {settings.index_dir}")
    server.serve_forever()


if __name__ == "__main__":
    main()
