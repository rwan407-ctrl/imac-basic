const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const topKInput = document.querySelector("#top-k");
const rerankInput = document.querySelector("#rerank");
const resultsEl = document.querySelector("#results");
const summaryEl = document.querySelector("#summary");
const statusEl = document.querySelector("#status");
const statsEl = document.querySelector("#stats");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function badge(label, confidence) {
  return `<span class="badge ${label}">${label} ${Math.round(confidence * 100)}%</span>`;
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Index unavailable");
    statusEl.textContent = "ready";
    statsEl.textContent = `${data.chunk_count} chunks across ${data.chapter_count} chapters`;
  } catch (error) {
    statusEl.textContent = "offline";
    statsEl.textContent = error.message;
  }
}

function renderResults(data) {
  summaryEl.hidden = false;
  summaryEl.innerHTML = `${badge(data.query_confidence_label, data.query_confidence)} <strong>${data.results.length}</strong> results in <strong>${data.elapsed_ms} ms</strong>`;
  if (data.warnings && data.warnings.length) {
    summaryEl.innerHTML += `<div>${data.warnings.map(escapeHtml).join("<br>")}</div>`;
  }

  if (!data.results.length) {
    resultsEl.innerHTML = `<div class="empty">No results</div>`;
    return;
  }

  resultsEl.innerHTML = data.results
    .map((result, index) => {
      const scores = escapeHtml(JSON.stringify(result.scores, null, 2));
      const evidenceHtml = result.section_html
        ? `
          <section class="evidence-html">
            <div class="evidence-label">Handbook HTML evidence</div>
            <div class="evidence-body">${result.section_html}</div>
          </section>
        `
        : "";
      return `
        <article class="result">
          <div class="result-head">
            <div>
              <h2>${index + 1}. ${escapeHtml(result.chapter_title)}</h2>
              <p class="section">${escapeHtml(result.section)}</p>
            </div>
            ${badge(result.confidence_label, result.confidence)}
          </div>
          <p class="snippet">${escapeHtml(result.snippet)}</p>
          <div class="meta">
            <a href="${escapeHtml(result.local_html_url)}" target="_blank" rel="noreferrer">Open local HTML</a>
            <a href="${escapeHtml(result.url)}" target="_blank" rel="noreferrer">Original source</a>
            <span>${escapeHtml(result.chunk_id)}</span>
          </div>
          ${evidenceHtml}
          <details>
            <summary>Scores</summary>
            <pre>${scores}</pre>
          </details>
        </article>
      `;
    })
    .join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;
  resultsEl.innerHTML = `<div class="empty">Searching...</div>`;
  summaryEl.hidden = true;

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        top_k: Number(topKInput.value || 8),
        rerank: rerankInput.checked,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed");
    renderResults(data);
  } catch (error) {
    resultsEl.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
});

loadStats();
