# IMAC Handbook Hybrid Search Tool

Retrieval-only search over the New Zealand Immunisation Handbook HTML export.

The tool uses the bundled HTML files in `static\handbook` as the source of truth, builds local dense embeddings, runs BM25 and dense search in parallel, fuses rankings with Reciprocal Rank Fusion, optionally reranks with a local cross-encoder, and returns retrieval confidence for each result.

The frontend also serves the styled handbook export from `static\handbook`. Search results include:

- One highlighted result at a time, ranked by hybrid retrieval and reranking, with a `Next match` button for moving through the top ranked matches.
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
  "rerank": true
}
```

Confidence is retrieval confidence only. It is not a measure of clinical correctness.

## Tests

```powershell
python -m unittest discover -s tests
python tests\smoke_test.py
```
