from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import ThreadingHTTPServer
from pathlib import Path


if not getattr(sys, "frozen", False):
    ROOT = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(ROOT / "src"))

from imac_search.server import Handler


def _port_is_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex((host, port)) != 0


def _available_port(host: str, start: int = 8765) -> int:
    for port in range(start, start + 25):
        if _port_is_available(host, port):
            return port
    raise RuntimeError("No available local port found.")


def _health_url(host: str, port: int) -> str:
    return f"http://{host}:{port}/health"


def _search_url(host: str, port: int) -> str:
    return f"http://{host}:{port}/api/search"


def _app_url(
    host: str,
    port: int,
    query: str | None = None,
    reranker_model: str = "default",
) -> str:
    params = {"version": "decision-watershed"}
    if query:
        params["q"] = query
        params["reranker_model"] = reranker_model
    return f"http://{host}:{port}/?{urllib.parse.urlencode(params)}"


def _service_is_running(host: str, port: int) -> bool:
    try:
        with urllib.request.urlopen(_health_url(host, port), timeout=1.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return bool(payload.get("ok"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError):
        return False


def _preload_search(host: str, port: int, query: str, reranker_model: str) -> dict:
    payload = json.dumps(
        {
            "query": query,
            "top_k": 5,
            "rerank": True,
            "reranker_model": reranker_model,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        _search_url(host, port),
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        data = json.loads(response.read().decode("utf-8"))
    if "error" in data:
        raise RuntimeError(str(data["error"]))
    return data


def _entry_command(host: str, port: int) -> list[str]:
    if getattr(sys, "frozen", False):
        return [sys.executable, "--no-ui", "--host", host, "--port", str(port)]
    return [
        sys.executable,
        str(Path(__file__).resolve()),
        "--no-ui",
        "--host",
        host,
        "--port",
        str(port),
    ]


def _start_service_process(host: str, port: int) -> subprocess.Popen:
    kwargs = {
        "cwd": str(Path(__file__).resolve().parents[1]),
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if sys.platform.startswith("win"):
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return subprocess.Popen(_entry_command(host, port), **kwargs)


def _ensure_service(host: str, requested_port: int, auto_port: bool) -> int:
    if _service_is_running(host, requested_port):
        return requested_port

    port = requested_port
    if not _port_is_available(host, requested_port):
        if not auto_port:
            raise RuntimeError(
                f"Port {requested_port} is already in use, but it does not look like IMAC Decision Watershed."
            )
        port = _available_port(host, requested_port)

    _start_service_process(host, port)
    deadline = time.time() + 20
    while time.time() < deadline:
        if _service_is_running(host, port):
            return port
        time.sleep(0.25)
    raise RuntimeError("IMAC Decision Watershed did not start in time.")


def _serve_forever(host: str, port: int) -> None:
    if not _port_is_available(host, port):
        url = _app_url(host, port)
        if _service_is_running(host, port):
            print(f"IMAC Decision Watershed is already running at {url}")
            return
        raise RuntimeError(f"Port {port} is already in use.")

    server = ThreadingHTTPServer((host, port), Handler)
    print(f"IMAC Decision Watershed is running at {_app_url(host, port)}")
    print("Browser was not opened automatically. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    finally:
        server.server_close()


def _show_search_window(host: str, port: int) -> None:
    import tkinter as tk
    from tkinter import ttk
    from tkinter import messagebox

    root = tk.Tk()
    root.title("IMAC Decision Watershed")
    root.geometry("560x198")
    root.resizable(False, False)
    root.configure(bg="#eef4f8")

    container = tk.Frame(root, bg="#eef4f8", padx=18, pady=16)
    container.pack(fill="both", expand=True)

    title = tk.Label(
        container,
        text="IMAC Handbook Search",
        bg="#eef4f8",
        fg="#0b1f4d",
        font=("Segoe UI", 14, "bold"),
        anchor="w",
    )
    title.pack(fill="x")

    subtitle = tk.Label(
        container,
        text="Type a question, then Search opens the browser with highlighted handbook evidence.",
        bg="#eef4f8",
        fg="#657084",
        font=("Segoe UI", 9),
        anchor="w",
    )
    subtitle.pack(fill="x", pady=(2, 10))

    row = tk.Frame(container, bg="#eef4f8")
    row.pack(fill="x")

    query_var = tk.StringVar(value="MMR contraindications during pregnancy")
    entry = tk.Entry(row, textvariable=query_var, font=("Segoe UI", 11), relief="solid", bd=1)
    entry.pack(side="left", fill="x", expand=True, ipady=8)

    settings_row = tk.Frame(container, bg="#eef4f8")
    settings_row.pack(fill="x", pady=(10, 0))

    model_label = tk.Label(
        settings_row,
        text="Reranker",
        bg="#eef4f8",
        fg="#657084",
        font=("Segoe UI", 9, "bold"),
    )
    model_label.pack(side="left")

    model_choices = {"Default": "default", "Stronger": "strong"}
    model_var = tk.StringVar(value="Default")
    model_select = ttk.Combobox(
        settings_row,
        textvariable=model_var,
        values=tuple(model_choices.keys()),
        state="readonly",
        width=14,
    )
    model_select.pack(side="left", padx=(8, 0))

    model_hint = tk.Label(
        settings_row,
        text="Default is faster; Stronger may take longer the first time.",
        bg="#eef4f8",
        fg="#657084",
        font=("Segoe UI", 9),
    )
    model_hint.pack(side="left", padx=(10, 0))

    def set_busy(is_busy: bool) -> None:
        entry.config(state="disabled" if is_busy else "normal")
        button.config(state="disabled" if is_busy else "normal")
        model_select.config(state="disabled" if is_busy else "readonly")

    def set_status(message: str) -> None:
        status.config(text=message)

    def open_search() -> None:
        query = query_var.get().strip()
        if not query:
            entry.focus_set()
            return
        selected_label = model_var.get()
        selected_model = model_choices[selected_label]
        loading_text = (
            "Loading Stronger reranker, then opening results..."
            if selected_model == "strong"
            else "Searching, then opening results..."
        )
        set_busy(True)
        set_status(loading_text)

        def worker() -> None:
            try:
                _preload_search(host, port, query, selected_model)
                root.after(0, set_status, "Ready. Opening highlighted handbook page...")
                webbrowser.open(_app_url(host, port, query, selected_model))
                root.after(0, set_status, f"Opened results at 127.0.0.1:{port}")
            except Exception as exc:  # noqa: BLE001 - show launcher-friendly error.
                root.after(0, set_status, "Search did not complete.")
                root.after(
                    0,
                    messagebox.showerror,
                    "IMAC Decision Watershed",
                    f"Could not prepare the search results.\n\n{exc}",
                )
            finally:
                root.after(0, set_busy, False)

        threading.Thread(target=worker, daemon=True).start()

    button = tk.Button(
        row,
        text="Search",
        command=open_search,
        bg="#147c73",
        fg="white",
        activebackground="#0d5e57",
        activeforeground="white",
        relief="flat",
        padx=18,
        pady=9,
        font=("Segoe UI", 10, "bold"),
    )
    button.pack(side="left", padx=(10, 0))

    status = tk.Label(
        container,
        text=f"Local service ready: 127.0.0.1:{port}",
        bg="#eef4f8",
        fg="#657084",
        font=("Segoe UI", 9),
        anchor="w",
    )
    status.pack(fill="x", pady=(10, 0))

    root.bind("<Return>", lambda _event: open_search())
    entry.focus_set()
    entry.selection_range(0, tk.END)

    try:
        root.mainloop()
    except tk.TclError as exc:
        messagebox.showerror("IMAC Decision Watershed", str(exc))


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the IMAC Decision Watershed local service or search launcher.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--auto-port",
        action="store_true",
        help="Use the next available port if the requested port is occupied by another app.",
    )
    parser.add_argument(
        "--no-ui",
        action="store_true",
        help="Run only the local service and do not show the search launcher.",
    )
    parser.add_argument(
        "--open-browser",
        action="store_true",
        help="Open the browser home page after the local service starts.",
    )
    args = parser.parse_args()

    if args.no_ui:
        _serve_forever(args.host, args.port)
        return

    try:
        port = _ensure_service(args.host, args.port, args.auto_port)
    except RuntimeError as exc:
        print(str(exc))
        return

    if args.open_browser:
        webbrowser.open(_app_url(args.host, port))
    _show_search_window(args.host, port)


if __name__ == "__main__":
    main()
