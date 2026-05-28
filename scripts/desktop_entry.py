from __future__ import annotations

import socket
import sys
import webbrowser
from http.server import ThreadingHTTPServer
from pathlib import Path


if not getattr(sys, "frozen", False):
    ROOT = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(ROOT / "src"))

from imac_search.server import Handler


def _available_port(start: int = 8765) -> int:
    for port in range(start, start + 25):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.25)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("No available local port found.")


def main() -> None:
    host = "127.0.0.1"
    port = _available_port()
    server = ThreadingHTTPServer((host, port), Handler)
    url = f"http://{host}:{port}/?version=decision-watershed"
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
