const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const topKInput = document.querySelector("#top-k");
const rerankInput = document.querySelector("#rerank");
const rerankerModelInput = document.querySelector("#reranker-model");
const testQuestionSelect = document.querySelector("#test-question-select");
const testRunButton = document.querySelector("#test-run");
const testSaveButton = document.querySelector("#test-save");
const testPinButton = document.querySelector("#test-pin");
const testDeleteButton = document.querySelector("#test-delete");
const testStatusEl = document.querySelector("#test-status");
const resultsEl = document.querySelector("#results");
const summaryEl = document.querySelector("#summary");
const statusEl = document.querySelector("#status");
const statsEl = document.querySelector("#stats");
const searchPanel = document.querySelector("#search-panel");
const searchLauncher = document.querySelector("#search-launcher");
const chapterViewer = document.querySelector("#chapter-viewer");
const chapterViewerTitle = document.querySelector("#chapter-viewer-title");
const chapterViewerSection = document.querySelector("#chapter-viewer-section");
const chapterViewerOpen = document.querySelector("#chapter-viewer-open");
const chapterViewerScore = document.querySelector("#chapter-viewer-score");
const chapterViewerNav = document.querySelector("#chapter-viewer-nav");
const chapterViewerFeedback = document.querySelector("#chapter-viewer-feedback");
const chapterFrame = document.querySelector("#chapter-frame");

const SEARCH_POOL_SIZE = 5;
const TEST_BANK_STORAGE_KEY = "imac.testQuestions.v1";
const BUILTIN_TEST_QUESTIONS = [
  {
    id: "builtin-mmr-pregnancy",
    question: "MMR contraindications during pregnancy",
  },
  {
    id: "builtin-anaphylaxis-adrenaline",
    question: "anaphylaxis adrenaline dose",
  },
  {
    id: "builtin-zoster-eligibility",
    question: "zoster vaccine eligibility",
  },
  {
    id: "builtin-six-week-schedule",
    question: "6-week immunisation schedule",
  },
  {
    id: "builtin-rotavirus-age-limits",
    question: "rotavirus vaccine age limits",
  },
];
let currentData = null;
let activeResultIndex = 0;
const feedbackByChunk = new Map();
let memoryTestBank = { custom: [], pinned: {}, hiddenBuiltins: [] };
let testBank = loadTestBank();

function expandSearch(focusInput = true) {
  searchPanel.classList.add("expanded");
  if (focusInput) {
    window.setTimeout(() => queryInput.focus(), 0);
  }
}

function collapseSearchIfIdle() {
  window.setTimeout(() => {
    if (!searchPanel.matches(":hover") && !searchPanel.contains(document.activeElement)) {
      searchPanel.classList.remove("expanded");
    }
  }, 90);
}

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

async function requestJson(url, options = {}) {
  if (typeof fetch === "function") {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  if (typeof XMLHttpRequest === "undefined") {
    throw new Error("No browser request API is available.");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "GET", url, true);
    Object.entries(options.headers || {}).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch (_error) {
        reject(new Error("Request returned invalid JSON"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data.error || "Request failed"));
        return;
      }
      resolve(data);
    };
    xhr.onerror = () => reject(new Error("Request failed"));
    xhr.send(options.body || null);
  });
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
      <button class="score-symbol ${escapeHtml(result.confidence_label)}" type="button" aria-label="Score details">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 17v-6"></path>
          <path d="M12 7h.01"></path>
        </svg>
      </button>
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

function normalizeQueryText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function loadTestBank() {
  try {
    if (typeof localStorage === "undefined") {
      return cloneTestBank(memoryTestBank);
    }
    const parsed = JSON.parse(localStorage.getItem(TEST_BANK_STORAGE_KEY) || "{}");
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      pinned: parsed.pinned && typeof parsed.pinned === "object" ? parsed.pinned : {},
      hiddenBuiltins: Array.isArray(parsed.hiddenBuiltins) ? parsed.hiddenBuiltins : [],
    };
  } catch (_error) {
    return cloneTestBank(memoryTestBank);
  }
}

function cloneTestBank(bank) {
  return {
    custom: [...(bank.custom || [])],
    pinned: { ...(bank.pinned || {}) },
    hiddenBuiltins: [...(bank.hiddenBuiltins || [])],
  };
}

function saveTestBank() {
  memoryTestBank = cloneTestBank(testBank);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TEST_BANK_STORAGE_KEY, JSON.stringify(testBank));
    }
  } catch (_error) {
    // In private or embedded browser contexts, keep the session-local copy.
  }
}

function testStatus(message) {
  if (testStatusEl) testStatusEl.textContent = message;
}

function allTestQuestions(includeHidden = false) {
  const hidden = new Set(testBank.hiddenBuiltins || []);
  const builtins = BUILTIN_TEST_QUESTIONS
    .filter((item) => includeHidden || !hidden.has(item.id))
    .map((item, index) => ({
      ...item,
      builtIn: true,
      pinned: Boolean(testBank.pinned?.[item.id]),
      order: index,
    }));
  const custom = (testBank.custom || []).map((item, index) => ({
    id: item.id,
    question: item.question,
    builtIn: false,
    pinned: Boolean(item.pinned),
    order: BUILTIN_TEST_QUESTIONS.length + index,
  }));

  return [...builtins, ...custom].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.order - b.order;
  });
}

function selectedTestQuestion() {
  return allTestQuestions().find((item) => item.id === testQuestionSelect.value);
}

function renderTestQuestions(selectedId = testQuestionSelect?.value || "") {
  if (!testQuestionSelect) return;
  const questions = allTestQuestions();
  if (!questions.length) {
    testQuestionSelect.innerHTML = `<option value="">No test questions saved</option>`;
    testRunButton.disabled = true;
    testPinButton.disabled = true;
    testDeleteButton.disabled = true;
    return;
  }

  testQuestionSelect.innerHTML = questions
    .map((item) => {
      const label = `${item.pinned ? "[Pinned] " : ""}${item.question}${item.builtIn ? " (built-in)" : ""}`;
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  const stillExists = questions.some((item) => item.id === selectedId);
  testQuestionSelect.value = stillExists ? selectedId : questions[0].id;
  const selected = selectedTestQuestion();
  testRunButton.disabled = !selected;
  testPinButton.disabled = !selected;
  testDeleteButton.disabled = !selected;
  testPinButton.textContent = selected?.pinned ? "Unpin" : "Pin";
}

function selectTestQuestion(id) {
  renderTestQuestions(id);
  const selected = selectedTestQuestion();
  if (!selected) return;
  queryInput.value = selected.question;
}

function saveCurrentTestQuestion() {
  const question = normalizeQueryText(queryInput.value);
  if (!question) {
    testStatus("Type a question first.");
    queryInput.focus();
    return;
  }

  const duplicate = allTestQuestions(true).find(
    (item) => item.question.toLowerCase() === question.toLowerCase(),
  );
  if (duplicate) {
    if (duplicate.builtIn) {
      testBank.hiddenBuiltins = (testBank.hiddenBuiltins || []).filter((id) => id !== duplicate.id);
    }
    saveTestBank();
    selectTestQuestion(duplicate.id);
    testStatus("Already in the test list.");
    return;
  }

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? `custom-${crypto.randomUUID()}`
      : `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  testBank.custom = [
    ...(testBank.custom || []),
    {
      id,
      question,
      pinned: false,
      createdAt: new Date().toISOString(),
    },
  ];
  saveTestBank();
  selectTestQuestion(id);
  testStatus("Saved to test questions.");
}

function toggleSelectedTestPin() {
  const selected = selectedTestQuestion();
  if (!selected) return;

  if (selected.builtIn) {
    if (testBank.pinned?.[selected.id]) {
      delete testBank.pinned[selected.id];
    } else {
      testBank.pinned = { ...(testBank.pinned || {}), [selected.id]: true };
    }
  } else {
    testBank.custom = (testBank.custom || []).map((item) =>
      item.id === selected.id ? { ...item, pinned: !item.pinned } : item,
    );
  }
  saveTestBank();
  renderTestQuestions(selected.id);
  testStatus(selected.pinned ? "Unpinned." : "Pinned.");
}

function deleteSelectedTestQuestion() {
  const selected = selectedTestQuestion();
  if (!selected) return;

  if (selected.builtIn) {
    testBank.hiddenBuiltins = Array.from(new Set([...(testBank.hiddenBuiltins || []), selected.id]));
    if (testBank.pinned?.[selected.id]) delete testBank.pinned[selected.id];
  } else {
    testBank.custom = (testBank.custom || []).filter((item) => item.id !== selected.id);
  }
  saveTestBank();
  renderTestQuestions();
  const next = selectedTestQuestion();
  if (next) queryInput.value = next.question;
  testStatus("Deleted from test questions.");
}

function rankNavigation(total) {
  const previousDisabled = total <= 1;
  const nextDisabled = total <= 1;
  const previousIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>`;
  const nextIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
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
    <button class="pager-button" type="button" data-action="previous-result" ${previousDisabled ? "disabled" : ""}>
      ${previousIcon}<span>Previous</span>
    </button>
    <span class="rank-buttons">${rankButtons}</span>
    <span class="match-position">${activeResultIndex + 1}/${total}</span>
    <button class="pager-button" type="button" data-action="next-result" ${nextDisabled ? "disabled" : ""}>
      <span>Next</span>${nextIcon}
    </button>
  `;
}

async function loadStats() {
  try {
    const data = await requestJson("/api/stats");
    statusEl.textContent = "ready";
    statusEl.dataset.state = "ready";
    statsEl.textContent = `${data.chunk_count} chunks across ${data.chapter_count} chapters`;
    if (data.reranker_models && rerankerModelInput) {
      rerankerModelInput.innerHTML = data.reranker_models
        .map((item) => {
          const selected = item.key === "default" ? "selected" : "";
          return `<option value="${escapeHtml(item.key)}" ${selected}>${escapeHtml(item.label)}</option>`;
        })
        .join("");
    }
  } catch (error) {
    statusEl.textContent = "offline";
    statusEl.dataset.state = "offline";
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
    document.body.classList.remove("reader-mode");
    expandSearch(false);
    resultsEl.innerHTML = `<div class="empty">No results</div>`;
    chapterViewer.hidden = true;
    return;
  }

  document.body.classList.add("reader-mode");
  searchPanel.classList.remove("expanded");
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
  if (!target) return;

  if (target.dataset.action === "back-to-search") {
    document.body.classList.remove("reader-mode");
    window.scrollTo({ top: 0, behavior: "smooth" });
    expandSearch();
    return;
  }

  if (!currentData || !currentData.results.length) return;

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
    const selectedKind = target.dataset.feedback;
    const currentValue = feedbackByChunk.get(result.chunk_id);
    if (currentValue === selectedKind) {
      feedbackByChunk.delete(result.chunk_id);
    } else {
      feedbackByChunk.set(result.chunk_id, selectedKind);
    }
    renderActiveResult();
  }
}

resultsEl.addEventListener("click", handleResultControls);
chapterViewer.addEventListener("click", handleResultControls);

async function performSearch(query) {
  if (!query) return;
  document.body.classList.remove("reader-mode");
  form.dataset.state = "searching";
  searchPanel.classList.add("expanded");
  resultsEl.innerHTML = `<div class="empty">Searching...</div>`;
  summaryEl.hidden = true;

  try {
    const data = await requestJson("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        top_k: Number(topKInput.value || SEARCH_POOL_SIZE),
        rerank: rerankInput.checked,
        reranker_model: rerankerModelInput.value || "default",
      }),
    });
    renderResults(data);
  } catch (error) {
    expandSearch(false);
    resultsEl.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  } finally {
    delete form.dataset.state;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await performSearch(queryInput.value.trim());
});

testQuestionSelect.addEventListener("change", () => {
  const selected = selectedTestQuestion();
  if (!selected) return;
  queryInput.value = selected.question;
  renderTestQuestions(selected.id);
  testStatus("Loaded into the search box.");
});

testRunButton.addEventListener("click", async () => {
  const selected = selectedTestQuestion();
  const query = normalizeQueryText(selected?.question || queryInput.value);
  if (!query) {
    testStatus("Choose or type a test question first.");
    return;
  }
  queryInput.value = query;
  testStatus("Running test question...");
  await performSearch(query);
});

testSaveButton.addEventListener("click", saveCurrentTestQuestion);
testPinButton.addEventListener("click", toggleSelectedTestPin);
testDeleteButton.addEventListener("click", deleteSelectedTestQuestion);

searchLauncher.addEventListener("click", () => expandSearch());
searchLauncher.addEventListener("focus", () => expandSearch());
searchPanel.addEventListener("pointerenter", () => {
  if (!document.body.classList.contains("reader-mode")) expandSearch();
});
searchPanel.addEventListener("mouseenter", () => {
  if (!document.body.classList.contains("reader-mode")) expandSearch();
});
searchPanel.addEventListener("mouseleave", collapseSearchIfIdle);
searchPanel.addEventListener("focusout", collapseSearchIfIdle);

async function initialize() {
  renderTestQuestions();
  await loadStats();
  const params = new URLSearchParams(window.location.search);
  const urlQuery = params.get("q");
  const urlRerankerModel = params.get("reranker_model");
  if (urlRerankerModel && rerankerModelInput.querySelector(`option[value="${CSS.escape(urlRerankerModel)}"]`)) {
    rerankerModelInput.value = urlRerankerModel;
  }
  if (urlQuery) {
    queryInput.value = urlQuery;
    await performSearch(urlQuery.trim());
  }
}

initialize();
