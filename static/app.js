const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const topKInput = document.querySelector("#top-k");
const rerankInput = document.querySelector("#rerank");
const resultsEl = document.querySelector("#results");
const summaryEl = document.querySelector("#summary");
const statusEl = document.querySelector("#status");
const statsEl = document.querySelector("#stats");
const chapterViewer = document.querySelector("#chapter-viewer");
const chapterViewerTitle = document.querySelector("#chapter-viewer-title");
const chapterViewerSection = document.querySelector("#chapter-viewer-section");
const chapterViewerOpen = document.querySelector("#chapter-viewer-open");
const chapterViewerScore = document.querySelector("#chapter-viewer-score");
const chapterViewerNext = document.querySelector("#chapter-viewer-next");
const chapterFrame = document.querySelector("#chapter-frame");

const SEARCH_POOL_SIZE = 5;
let currentData = null;
let activeResultIndex = 0;

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

function scoreLabel(key) {
  const labels = {
    rrf_norm: "RRF norm",
    branch_agreement: "BM25/dense agreement",
    score_gap: "Score gap",
    final_score: "Final score",
    rrf_score: "RRF score",
    sparse_rank: "BM25 rank",
    dense_rank: "Dense rank",
    sparse_score: "BM25 score",
    dense_score: "Dense score",
    reranker_score: "Reranker score",
    reranker_norm: "Reranker norm",
  };
  return labels[key] || key.replaceAll("_", " ");
}

function scoreValue(key, value) {
  if (typeof value !== "number") return escapeHtml(value);
  if (key.endsWith("_rank")) return String(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

function scoreInfo(result, index, total) {
  const rows = Object.entries(result.scores || {})
    .map(
      ([key, value]) => `
        <div class="score-row">
          <span>${escapeHtml(scoreLabel(key))}</span>
          <strong>${escapeHtml(scoreValue(key, value))}</strong>
        </div>
      `,
    )
    .join("");

  return `
    <span class="score-hover">
      <button class="score-symbol ${escapeHtml(result.confidence_label)}" type="button" aria-label="Score details">i</button>
      <span class="score-popover" role="tooltip">
        <span class="score-title">Rank ${index + 1} of ${total}</span>
        <span class="score-note">Retrieval confidence, not medical truth.</span>
        <span class="score-grid">${rows}</span>
      </span>
    </span>
  `;
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
  currentData = data;
  activeResultIndex = 0;

  summaryEl.hidden = false;
  summaryEl.innerHTML = `${badge(data.query_confidence_label, data.query_confidence)} ${data.results.length} ranked matches in <strong>${data.elapsed_ms} ms</strong>`;
  if (data.warnings && data.warnings.length) {
    summaryEl.innerHTML += `<div>${data.warnings.map(escapeHtml).join("<br>")}</div>`;
  }

  if (!data.results.length) {
    resultsEl.innerHTML = `<div class="empty">No results</div>`;
    chapterViewer.hidden = true;
    return;
  }

  renderActiveResult();
}

function renderActiveResult() {
  if (!currentData || !currentData.results.length) return;

  const total = currentData.results.length;
  const result = currentData.results[activeResultIndex];
  const nextLabel = total > 1 ? `Next match (${(activeResultIndex + 1) % total + 1}/${total})` : "Next match";
  resultsEl.innerHTML = `
    <div class="candidate-strip ${escapeHtml(result.confidence_label)}">
      <div>
        <strong>Rank ${activeResultIndex + 1} of ${total}</strong>
        <span>${escapeHtml(result.chunk_id)}</span>
      </div>
      <div class="candidate-actions">
        ${badge(result.confidence_label, result.confidence)}
        <button class="next-result" type="button" data-action="next-result" ${total <= 1 ? "disabled" : ""}>${escapeHtml(nextLabel)}</button>
      </div>
    </div>
    <article class="result best-result ${escapeHtml(result.confidence_label)}">
      <div class="result-head">
        <div>
          <h2>${escapeHtml(result.chapter_title)}</h2>
          <p class="section">${escapeHtml(result.section)}</p>
        </div>
      </div>
      <p class="snippet">${escapeHtml(result.snippet)}</p>
      <div class="meta">
        <a href="${escapeHtml(result.highlighted_html_url)}" target="_blank" rel="noreferrer">Open highlighted page</a>
        <a href="${escapeHtml(result.local_html_url)}" target="_blank" rel="noreferrer">Open local HTML</a>
        <a href="${escapeHtml(result.url)}" target="_blank" rel="noreferrer">Original source</a>
        <span>${escapeHtml(result.chunk_id)}</span>
      </div>
    </article>
  `;

  chapterViewer.hidden = false;
  chapterViewerTitle.textContent = result.chapter_title;
  chapterViewerSection.textContent = result.section;
  chapterViewerOpen.href = result.highlighted_html_url;
  chapterViewerScore.innerHTML = `${badge(result.confidence_label, result.confidence)} ${scoreInfo(result, activeResultIndex, total)}`;
  chapterViewerNext.textContent = nextLabel;
  chapterViewerNext.disabled = total <= 1;
  chapterFrame.src = result.highlighted_html_url;

  const nextButton = resultsEl.querySelector("[data-action='next-result']");
  if (nextButton) {
    nextButton.addEventListener("click", showNextResult);
  }
}

function showNextResult() {
  if (!currentData || currentData.results.length <= 1) return;
  activeResultIndex = (activeResultIndex + 1) % currentData.results.length;
  renderActiveResult();
}

chapterViewerNext.addEventListener("click", showNextResult);

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
        top_k: Number(topKInput.value || SEARCH_POOL_SIZE),
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
