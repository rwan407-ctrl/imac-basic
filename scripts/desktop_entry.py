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
else:
    ROOT = Path(sys.executable).resolve().parent

from imac_search.server import Handler


TEST_BANK_PATH = ROOT / "config" / "test_questions.local.json"
DEFAULT_TEST_QUESTIONS = [
    {"id": "builtin-mmr-pregnancy", "question": "MMR contraindications during pregnancy"},
    {"id": "builtin-anaphylaxis-adrenaline", "question": "anaphylaxis adrenaline dose"},
    {"id": "builtin-zoster-eligibility", "question": "zoster vaccine eligibility"},
    {"id": "builtin-six-week-schedule", "question": "6-week immunisation schedule"},
    {"id": "builtin-rotavirus-age-limits", "question": "rotavirus vaccine age limits"},
]
DEFAULT_RERANKER_LABEL = "Strongest (Jina)"
RERANKER_CHOICES = {
    "Strongest (Jina)": "jina",
    "Stronger": "strong",
    "Default": "default",
}
BASE_WINDOW_GEOMETRY = "760x270"
SETTINGS_WINDOW_GEOMETRY = "760x310"


def _normalize_question(value: str) -> str:
    return " ".join(value.split()).strip()


def _empty_test_bank() -> dict:
    return {"custom": [], "pinned": {}, "hidden_builtins": []}


def _load_test_bank(path: Path = TEST_BANK_PATH) -> dict:
    if not path.exists():
        return _empty_test_bank()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _empty_test_bank()
    return {
        "custom": data.get("custom") if isinstance(data.get("custom"), list) else [],
        "pinned": data.get("pinned") if isinstance(data.get("pinned"), dict) else {},
        "hidden_builtins": data.get("hidden_builtins")
        if isinstance(data.get("hidden_builtins"), list)
        else [],
    }


def _save_test_bank(bank: dict, path: Path = TEST_BANK_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")


def _test_questions(bank: dict) -> list[dict]:
    hidden = set(bank.get("hidden_builtins", []))
    pinned = bank.get("pinned", {})
    builtins = [
        {
            "id": item["id"],
            "question": item["question"],
            "built_in": True,
            "pinned": bool(pinned.get(item["id"])),
            "order": index,
        }
        for index, item in enumerate(DEFAULT_TEST_QUESTIONS)
        if item["id"] not in hidden
    ]
    custom = [
        {
            "id": item["id"],
            "question": item["question"],
            "built_in": False,
            "pinned": bool(item.get("pinned")),
            "order": len(DEFAULT_TEST_QUESTIONS) + index,
        }
        for index, item in enumerate(bank.get("custom", []))
        if item.get("id") and item.get("question")
    ]
    return sorted(
        [*builtins, *custom],
        key=lambda item: (0 if item["pinned"] else 1, item["order"]),
    )


def _display_test_question(item: dict) -> str:
    prefix = "[Pinned] " if item.get("pinned") else ""
    suffix = " (built-in)" if item.get("built_in") else ""
    return f"{prefix}{item['question']}{suffix}"


def _save_current_test_question(bank: dict, question: str) -> tuple[dict, str, str]:
    question = _normalize_question(question)
    if not question:
        return bank, "", "Type a question first."
    for item in _test_questions({**bank, "hidden_builtins": []}):
        if item["question"].lower() == question.lower():
            return bank, item["id"], "Already in the test list."
    custom_id = f"custom-{int(time.time() * 1000)}"
    bank["custom"] = [
        *bank.get("custom", []),
        {"id": custom_id, "question": question, "pinned": False, "created_at": time.strftime("%Y-%m-%dT%H:%M:%S")},
    ]
    return bank, custom_id, "Saved to test questions."


def _toggle_test_pin(bank: dict, question_id: str) -> tuple[dict, str]:
    selected = next((item for item in _test_questions(bank) if item["id"] == question_id), None)
    if selected is None:
        return bank, "Choose a test question first."
    if selected["built_in"]:
        pinned = dict(bank.get("pinned", {}))
        if pinned.get(question_id):
            pinned.pop(question_id, None)
            message = "Unpinned."
        else:
            pinned[question_id] = True
            message = "Pinned."
        bank["pinned"] = pinned
        return bank, message
    bank["custom"] = [
        {**item, "pinned": not bool(item.get("pinned"))} if item.get("id") == question_id else item
        for item in bank.get("custom", [])
    ]
    return bank, "Unpinned." if selected.get("pinned") else "Pinned."


def _delete_test_question(bank: dict, question_id: str) -> tuple[dict, str]:
    selected = next((item for item in _test_questions(bank) if item["id"] == question_id), None)
    if selected is None:
        return bank, "Choose a test question first."
    if selected["built_in"]:
        bank["hidden_builtins"] = sorted(set([*bank.get("hidden_builtins", []), question_id]))
        bank.get("pinned", {}).pop(question_id, None)
    else:
        bank["custom"] = [item for item in bank.get("custom", []) if item.get("id") != question_id]
    return bank, "Deleted from test questions."


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
    reranker_model: str = "jina",
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
    root.geometry(BASE_WINDOW_GEOMETRY)
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

    model_choices = RERANKER_CHOICES
    model_var = tk.StringVar(value=DEFAULT_RERANKER_LABEL)
    model_select = ttk.Combobox(
        settings_row,
        textvariable=model_var,
        values=tuple(model_choices.keys()),
        state="readonly",
        width=18,
    )
    model_select.pack(side="left", padx=(8, 0))

    model_hint = tk.Label(
        settings_row,
        text="Only change this if you want to downgrade for speed.",
        bg="#eef4f8",
        fg="#657084",
        font=("Segoe UI", 9),
    )
    model_hint.pack(side="left", padx=(10, 0))
    settings_row.pack_forget()

    test_bank = _load_test_bank()
    test_display_map: dict[str, dict] = {}

    test_row = tk.Frame(container, bg="#eef4f8")
    test_row.pack(fill="x", pady=(10, 0))

    test_label = tk.Label(
        test_row,
        text="Tests",
        bg="#eef4f8",
        fg="#657084",
        font=("Segoe UI", 9, "bold"),
    )
    test_label.pack(side="left")

    test_var = tk.StringVar(value="")
    test_select = ttk.Combobox(
        test_row,
        textvariable=test_var,
        state="readonly",
        width=50,
    )
    test_select.pack(side="left", fill="x", expand=True, padx=(8, 0))

    test_buttons = tk.Frame(container, bg="#eef4f8")
    test_buttons.pack(fill="x", pady=(8, 0))

    run_test_button = tk.Button(
        test_buttons,
        text="Run test",
        bg="#147c73",
        fg="white",
        activebackground="#0d5e57",
        activeforeground="white",
        relief="flat",
        padx=12,
        pady=5,
        font=("Segoe UI", 9, "bold"),
    )
    run_test_button.pack(side="left")

    save_test_button = tk.Button(
        test_buttons,
        text="Save current",
        bg="#ffffff",
        fg="#0d5e57",
        activebackground="#edf7f5",
        activeforeground="#0d5e57",
        relief="solid",
        bd=1,
        padx=10,
        pady=5,
        font=("Segoe UI", 9, "bold"),
    )
    save_test_button.pack(side="left", padx=(8, 0))

    pin_test_button = tk.Button(
        test_buttons,
        text="Pin",
        bg="#ffffff",
        fg="#0d5e57",
        activebackground="#edf7f5",
        activeforeground="#0d5e57",
        relief="solid",
        bd=1,
        padx=10,
        pady=5,
        font=("Segoe UI", 9, "bold"),
    )
    pin_test_button.pack(side="left", padx=(8, 0))

    delete_test_button = tk.Button(
        test_buttons,
        text="Delete",
        bg="#ffffff",
        fg="#9b1c1c",
        activebackground="#fff0f0",
        activeforeground="#9b1c1c",
        relief="solid",
        bd=1,
        padx=10,
        pady=5,
        font=("Segoe UI", 9, "bold"),
    )
    delete_test_button.pack(side="left", padx=(8, 0))

    test_hint = tk.Label(
        test_buttons,
        text="Choose a fixed question, or save the current input as a local test.",
        bg="#eef4f8",
        fg="#657084",
        font=("Segoe UI", 9),
    )
    test_hint.pack(side="left", padx=(10, 0))

    def set_busy(is_busy: bool) -> None:
        entry.config(state="disabled" if is_busy else "normal")
        button.config(state="disabled" if is_busy else "normal")
        settings_button.config(state="disabled" if is_busy else "normal")
        model_select.config(state="disabled" if is_busy else "readonly")
        test_select.config(state="disabled" if is_busy else "readonly")
        run_test_button.config(state="disabled" if is_busy else "normal")
        save_test_button.config(state="disabled" if is_busy else "normal")
        pin_test_button.config(state="disabled" if is_busy else "normal")
        delete_test_button.config(state="disabled" if is_busy else "normal")

    def set_status(message: str) -> None:
        status.config(text=message)

    def toggle_settings() -> None:
        if settings_row.winfo_ismapped():
            settings_row.pack_forget()
            settings_button.config(text="Settings")
            root.geometry(BASE_WINDOW_GEOMETRY)
        else:
            settings_row.pack(fill="x", pady=(10, 0), before=test_row)
            settings_button.config(text="Hide settings")
            root.geometry(SETTINGS_WINDOW_GEOMETRY)

    def selected_test_question() -> dict | None:
        return test_display_map.get(test_var.get())

    def refresh_test_controls(selected_id: str | None = None) -> None:
        nonlocal test_display_map
        questions = _test_questions(test_bank)
        test_display_map = {_display_test_question(item): item for item in questions}
        values = tuple(test_display_map.keys())
        test_select.config(values=values)
        if not values:
            test_var.set("")
            run_test_button.config(state="disabled")
            pin_test_button.config(state="disabled")
            delete_test_button.config(state="disabled")
            return
        selected_display = next(
            (
                display
                for display, item in test_display_map.items()
                if item["id"] == selected_id
            ),
            None,
        )
        if selected_display is None or selected_display not in test_display_map:
            selected_display = values[0]
        test_var.set(selected_display)
        selected = selected_test_question()
        pin_test_button.config(text="Unpin" if selected and selected.get("pinned") else "Pin")
        if entry.cget("state") != "disabled":
            run_test_button.config(state="normal")
            pin_test_button.config(state="normal")
            delete_test_button.config(state="normal")

    def load_selected_test_question() -> None:
        selected = selected_test_question()
        if selected is None:
            return
        query_var.set(selected["question"])
        pin_test_button.config(text="Unpin" if selected.get("pinned") else "Pin")
        set_status("Loaded test question into the search box.")

    def save_current_test_question() -> None:
        nonlocal test_bank
        test_bank, selected_id, message = _save_current_test_question(test_bank, query_var.get())
        _save_test_bank(test_bank)
        refresh_test_controls(selected_id or None)
        if selected_id:
            selected = next((item for item in _test_questions(test_bank) if item["id"] == selected_id), None)
            if selected is not None:
                query_var.set(selected["question"])
        set_status(message)

    def toggle_selected_test_pin() -> None:
        nonlocal test_bank
        selected = selected_test_question()
        if selected is None:
            set_status("Choose a test question first.")
            return
        test_bank, message = _toggle_test_pin(test_bank, selected["id"])
        _save_test_bank(test_bank)
        refresh_test_controls(selected["id"])
        set_status(message)

    def delete_selected_test_question() -> None:
        nonlocal test_bank
        selected = selected_test_question()
        if selected is None:
            set_status("Choose a test question first.")
            return
        test_bank, message = _delete_test_question(test_bank, selected["id"])
        _save_test_bank(test_bank)
        refresh_test_controls()
        next_selected = selected_test_question()
        if next_selected is not None:
            query_var.set(next_selected["question"])
        set_status(message)

    def run_selected_test_question() -> None:
        selected = selected_test_question()
        if selected is None:
            set_status("Choose a test question first.")
            return
        query_var.set(selected["question"])
        open_search()

    def open_search() -> None:
        query = query_var.get().strip()
        if not query:
            entry.focus_set()
            return
        selected_label = model_var.get()
        selected_model = model_choices[selected_label]
        loading_text = (
            "Loading local reranker, then opening results..."
            if selected_model in {"strong", "jina"}
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

    settings_button = tk.Button(
        row,
        text="Settings",
        bg="#ffffff",
        fg="#0d5e57",
        activebackground="#edf7f5",
        activeforeground="#0d5e57",
        relief="solid",
        bd=1,
        padx=12,
        pady=9,
        font=("Segoe UI", 10, "bold"),
    )
    settings_button.pack(side="left", padx=(8, 0))

    test_select.bind("<<ComboboxSelected>>", lambda _event: load_selected_test_question())
    settings_button.config(command=toggle_settings)
    run_test_button.config(command=run_selected_test_question)
    save_test_button.config(command=save_current_test_question)
    pin_test_button.config(command=toggle_selected_test_pin)
    delete_test_button.config(command=delete_selected_test_question)

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
    refresh_test_controls()
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
