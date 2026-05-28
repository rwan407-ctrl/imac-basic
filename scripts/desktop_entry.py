from __future__ import annotations

import argparse
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
        if _port_is_available("127.0.0.1", port):
            return port
    raise RuntimeError("No available local port found.")


def _port_is_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex((host, port)) != 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the IMAC Decision Watershed local service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--auto-port",
        action="store_true",
        help="Use the next available port if the requested port is occupied.",
    )
    parser.add_argument(
        "--open-browser",
        action="store_true",
        help="Open the browser after the local service starts.",
    )
    args = parser.parse_args()

    host = args.host
    port = _available_port(args.port) if args.auto_port else args.port
    url = f"http://{host}:{port}/?version=decision-watershed"
    if not _port_is_available(host, port):
        print(f"Port {port} is already in use.")
        print(f"If IMAC Decision Watershed is already running, open {url}")
        return

    server = ThreadingHTTPServer((host, port), Handler)
    print(f"IMAC Decision Watershed is running at {url}")
    print("Browser was not opened automatically. Press Ctrl+C to stop.")
    if args.open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
