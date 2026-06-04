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
- A `Tests` menu in the search launcher with built-in smoke-test questions plus user-saved questions. Saved questions can be pinned, selected, run, or deleted; supported browsers persist them in local storage.

## Run

Install dependencies once after cloning or downloading the project.

Windows PowerShell:

```powershell
cd C:\Users\fwang\Desktop\imac-basic
python -m pip install -r requirements.txt
```

macOS or Linux:

```bash
cd ~/Desktop/imac-basic
python3 -m pip install -r requirements.txt
```

`pip install -r requirements.txt` also works when `pip` already points to the same Python environment. `python -m pip` is safer because it installs into the Python interpreter used to run the app.

```powershell
cd C:\Users\fwang\Desktop\imac_hybrid_search_tool
python scripts\build_index.py
python scripts\serve.py --port 8765
```

Open http://127.0.0.1:8765

The generated `data\index` folder is intentionally not committed to GitHub. If the index is missing, the app rebuilds it from the bundled `static\handbook` files the first time search/stats are used. That first run can take longer because the embedding model may need to download.

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

On macOS or Linux, use forward slashes and `python3` if needed:

```bash
python3 scripts/desktop_entry.py
```

This opens a small local search bar. The browser does not open until you click `Search`. The launcher first prepares the retrieval request locally, so a first-time reranker load stays inside the search window; once the model and results are ready, it opens directly into highlighted handbook evidence for that query. If the local service is already running on port `8765`, the search bar reuses it. The desktop launcher also includes a `Tests` dropdown with built-in smoke-test questions plus locally saved questions. Desktop saved questions are stored in `config\test_questions.local.json`, which is ignored by Git.

The search bar and web launcher default to `Strongest (Jina)`, which uses `jinaai/jina-reranker-v2-base-multilingual` with local `sentence-transformers` execution. By default, reranking uses the chunk text only and does not include chapter, table/section heading, or parent section path. Users can turn on `Use table/section titles` in `Settings` to compare title-aware rerank behavior. Users can also switch among local rerankers including Stronger MiniLM, Mixedbread, Qwen3, BGE, Electra, and smaller MiniLM variants. The web Settings menu also includes an experimental `Azure Foundry API` reranker option for calling a user-provided Azure AI Foundry rerank endpoint. Larger local models may take longer the first time they are selected because the model has to be downloaded and loaded. The Jina model card lists a CC-BY-NC-4.0 license, so review licensing before commercial deployment.

Only one reranker is kept in memory at a time. When users switch reranker models, the previous model is unloaded before the next one is loaded so several large models can be tested one by one without accumulating GPU/CPU memory use.

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
  "reranker_model": "jina",
  "include_title_context": false
}
```

Available reranker values are `jina`, `strong`, `mixedbread`, `qwen3_06b`, `bge_m3`, `bge_base`, `electra`, `default`, `fast`, and `azure_foundry`. If omitted, the backend uses `jina`.

For Azure AI Foundry TEI-style rerank endpoints:

```json
{
  "query": "4X year old women, Azathioprine, MMR",
  "top_k": 5,
  "rerank": true,
  "reranker_model": "azure_foundry",
  "include_title_context": false,
  "azure_foundry": {
    "endpoint": "https://example.models.ai.azure.com",
    "api_key": "<token>",
    "request_format": "tei",
    "auth_type": "bearer"
  }
}
```

`request_format` can be `tei` for `query + texts` endpoints or `cohere` for `query + documents + top_n` endpoints. `auth_type` can be `bearer`, `api-key`, or `x-api-key`. Do not commit real keys.

For local use, the API key can be stored outside Git in either of these ignored files:

```text
config\azure_foundry.key
config\azure_foundry.local.json
```

`config\azure_foundry.key` should contain only the key/token. `config\azure_foundry.local.json` can contain optional defaults:

```json
{
  "endpoint": "https://example.models.ai.azure.com",
  "api_key": "<token>",
  "request_format": "tei",
  "auth_type": "bearer"
}
```

Environment variables are also supported: `IMAC_AZURE_FOUNDRY_API_KEY`, `IMAC_AZURE_FOUNDRY_KEY_FILE`, `IMAC_AZURE_FOUNDRY_ENDPOINT`, `IMAC_AZURE_FOUNDRY_REQUEST_FORMAT`, and `IMAC_AZURE_FOUNDRY_AUTH_TYPE`.

Confidence is retrieval confidence only. It is not a measure of clinical correctness.

## Tests

```powershell
python -m unittest discover -s tests
python tests\smoke_test.py
```
