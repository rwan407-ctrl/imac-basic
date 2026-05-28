# IMAC Handbook Hybrid Search Tool

Retrieval-only search over the New Zealand Immunisation Handbook HTML export.

The tool uses the bundled HTML files in `static\handbook` as the source of truth, builds local dense embeddings, runs BM25 and dense search in parallel, fuses rankings with Reciprocal Rank Fusion, optionally reranks with a local cross-encoder, and returns retrieval confidence for each result.

The frontend also serves the styled handbook export from `static\handbook`. Search results include:

- A "Decision Watershed" launcher mode: the search box starts as a bottom-right floating icon and expands immediately on hover/focus.
- One highlighted result at a time, ranked by hybrid retrieval and reranking, with previous/next controls and a compact rank list for moving through the top ranked matches.
- Placeholder thumbs-up/thumbs-down buttons for future relevance feedback workflows.
- A compact score icon that reveals the retrieval score breakdown on hover/focus.
- A full local handbook page positioned at the retrieved section, with a yellow section outline and highlighted query terms.
- `Open local HTML`: opens the styled local chapter/section in a new tab.
- `Original source`: opens the original Te Whatu Ora URL.

## Run

```powershell
cd C:\Users\fwang\Desktop\imac_hybrid_search_tool
python scripts\build_index.py
python scripts\serve.py --port 8765
```

Open http://127.0.0.1:8765

The styled handbook files live under:

```text
static\handbook
```

To build from a different HTML export, set `IMAC_HTML_DIR` before running `scripts\build_index.py`.

## Windows Launcher

To try the "Decision Watershed" desktop-style entry point:

```powershell
python scripts\desktop_entry.py
```

This opens a small local search bar. The browser does not open until you click `Search`. The launcher first prepares the retrieval request locally, so a first-time `Stronger` reranker load stays inside the search window; once the model and results are ready, it opens directly into highlighted handbook evidence for that query. If the local service is already running on port `8765`, the search bar reuses it.

The search bar and web launcher both expose a `Reranker` setting. `Default` keeps the current fast local reranker; `Stronger` uses a larger local cross-encoder; `Strongest (Jina)` uses `jinaai/jina-reranker-v2-base-multilingual` with local `sentence-transformers` execution. Stronger models may take longer the first time they are selected because the model has to be downloaded and loaded. The Jina model card lists a CC-BY-NC-4.0 license, so review licensing before commercial deployment.

To start only the local service in the background without showing the search bar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start_decision_watershed_hidden.ps1
```

To stop the background service:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop_decision_watershed.ps1
```

To start and open the browser immediately:

```powershell
python scripts\desktop_entry.py --open-browser
```

If port `8765` is already occupied and you want the tool to choose another local port:

```powershell
python scripts\desktop_entry.py --auto-port
```

To run only the service in the current terminal:

```powershell
python scripts\desktop_entry.py --no-ui
```

To build a Windows executable:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_decision_watershed_exe.ps1
```

The build script packages the current `static` and `data` folders, so run `python scripts\build_index.py` first.

## API

```http
GET /health
GET /api/stats
POST /api/search
```

Search body:

```json
{
  "query": "MMR contraindications during pregnancy",
  "top_k": 5,
  "rerank": true,
  "reranker_model": "default"
}
```

Available reranker values are `default`, `strong`, and `jina`.

Confidence is retrieval confidence only. It is not a measure of clinical correctness.

## Tests

```powershell
python -m unittest discover -s tests
python tests\smoke_test.py
```
