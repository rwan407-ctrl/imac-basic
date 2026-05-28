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
const chapterViewerNav = document.querySelector("#chapter-viewer-nav");
const chapterViewerFeedback = document.querySelector("#chapter-viewer-feedback");
const chapterFrame = document.querySelector("#chapter-frame");

const SEARCH_POOL_SIZE = 5;
let currentData = null;
let activeResultIndex = 0;
const feedbackByChunk = new Map();

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
        <span class="score-title">${index + 1}/${total}</span>
        <span class="score-note">Retrieval confidence, not medical truth.</span>
        <span class="score-grid">${rows}</span>
      </span>
    </span>
  `;
}

function feedbackButton(kind, currentValue) {
  const isActive = currentValue === kind;
  const label = kind === "up" ? "Mark useful" : "Mark not useful";
  const icon =
    kind === "up"
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m0 11V10l5-8a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-1 7a4 4 0 0 1-4 4H7Z"></path></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3m0-11v12l-5 8a3 3 0 0 1-3-3v-4H4a2 2 0 0 1-2-2l1-7a4 4 0 0 1 4-4h10Z"></path></svg>`;
  return `
    <button
      class="feedback-button ${isActive ? "active" : ""}"
      type="button"
      data-feedback="${kind}"
      aria-label="${label}"
      title="${label} placeholder"
      aria-pressed="${isActive ? "true" : "false"}"
    >${icon}</button>
  `;
}

function feedbackControls(result) {
  const currentValue = feedbackByChunk.get(result.chunk_id) || "";
  return `${feedbackButton("up", currentValue)}${feedbackButton("down", currentValue)}`;
}

function rankNavigation(total) {
  const previousDisabled = total <= 1;
  const nextDisabled = total <= 1;
  const rankButtons = Array.from({ length: total }, (_, index) => {
    const active = index === activeResultIndex;
    return `
      <button
        class="rank-button ${active ? "active" : ""}"
        type="button"
        data-rank-index="${index}"
        aria-label="Show match ${index + 1} of ${total}"
        aria-current="${active ? "true" : "false"}"
      >${index + 1}</button>
    `;
  }).join("");

  return `
    <button class="pager-button" type="button" data-action="previous-result" ${previousDisabled ? "disabled" : ""}>Previous</button>
    <span class="rank-buttons">${rankButtons}</span>
    <span class="match-position">${activeResultIndex + 1}/${total}</span>
    <button class="pager-button" type="button" data-action="next-result" ${nextDisabled ? "disabled" : ""}>Next</button>
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
  resultsEl.innerHTML = `
    <div class="candidate-strip ${escapeHtml(result.confidence_label)}">
      <div>
        <strong>${activeResultIndex + 1}/${total}</strong>
        <span>${escapeHtml(result.chunk_id)}</span>
      </div>
      <div class="candidate-actions">
        ${badge(result.confidence_label, result.confidence)}
        <div class="rank-nav" aria-label="Ranked matches">${rankNavigation(total)}</div>
        <div class="feedback-controls" aria-label="Result feedback">${feedbackControls(result)}</div>
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
  chapterViewerNav.innerHTML = rankNavigation(total);
  chapterViewerFeedback.innerHTML = feedbackControls(result);
  chapterFrame.src = result.highlighted_html_url;
}

function showNextResult() {
  if (!currentData || currentData.results.length <= 1) return;
  activeResultIndex = (activeResultIndex + 1) % currentData.results.length;
  renderActiveResult();
}

function showPreviousResult() {
  if (!currentData || currentData.results.length <= 1) return;
  activeResultIndex = (activeResultIndex - 1 + currentData.results.length) % currentData.results.length;
  renderActiveResult();
}

function showRank(index) {
  if (!currentData || index < 0 || index >= currentData.results.length) return;
  activeResultIndex = index;
  renderActiveResult();
}

function handleResultControls(event) {
  const target = event.target.closest("button");
  if (!target || !currentData || !currentData.results.length) return;

  if (target.dataset.action === "next-result") {
    showNextResult();
    return;
  }
  if (target.dataset.action === "previous-result") {
    showPreviousResult();
    return;
  }
  if (target.dataset.rankIndex !== undefined) {
    showRank(Number(target.dataset.rankIndex));
    return;
  }
  if (target.dataset.feedback) {
    const result = currentData.results[activeResultIndex];
    const currentValue = feedbackByChunk.get(result.chunk_id);
    if (currentValue === target.dataset.feedback) {
      feedbackByChunk.delete(result.chunk_id);
    } else {
      feedbackByChunk.set(result.chunk_id, target.dataset.feedback);
    }
    renderActiveResult();
  }
}

resultsEl.addEventListener("click", handleResultControls);
chapterViewer.addEventListener("click", handleResultControls);

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
