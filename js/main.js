// js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery } from "./latex.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js";
import { createSearchRunner } from "./search.js";

/* ---------- DOM ---------- */
const timeline = document.getElementById("timeline");
if (!timeline) {
  throw new Error("index.html に <div id='timeline'></div> がありません");
}

/* ---------- state ---------- */
let sortMode = "year";
const PAGE_SIZE = 5;
let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;

/* ---------- toolbar ---------- */
const { sortBtn } = buildToolbar(timeline, {
  onInput: (q) => runSearch(q),
  onClear: () => resetList(sortPosts(allPosts)),
  onSortToggle: () => toggleSort(),
});

/* ---------- util ---------- */
function sortPosts(list) {
  const arr = list.slice();
  if (sortMode === "difficulty") {
    arr.sort((a, b) => (b.avg || 0) - (a.avg || 0));
  } else {
    arr.sort((a, b) => {
      const d = String(b.date).localeCompare(String(a.date));
      if (d !== 0) return d;
      return (a.no || 0) - (b.no || 0);
    });
  }
  return arr;
}

function toggleSort() {
  sortMode = sortMode === "year" ? "difficulty" : "year";
  sortBtn.textContent =
    sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
  resetList(sortPosts(currentList));
}

/* ---------- infinite scroll ---------- */
const sentinel = document.createElement("div");
sentinel.style.height = "1px";

async function renderOne(p) {
  await ensureBodyLoaded(p);

  const ratedKey = `rated_${p.id}`;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");
  texEl.innerHTML = p.body;

  applyAvgClass(card.querySelector("[data-avg]"), p.avg);
  wireRatingButtons(card, p, ratedKey);

  timeline.appendChild(card);

  if (window.MathJax) {
    await MathJax.typesetPromise([texEl]);
  }
}

async function renderNextPage() {
  if (isLoading) return;
  isLoading = true;

  const next = currentList.slice(rendered, rendered + PAGE_SIZE);
  for (const p of next) await renderOne(p);
  rendered += next.length;

  if (rendered >= currentList.length) {
    sentinel.remove();
    observer?.disconnect();
  }

  isLoading = false;
}

function resetList(list) {
  currentList = list.slice();
  rendered = 0;
  timeline.innerHTML = "";
  timeline.appendChild(sentinel);

  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) renderNextPage();
    },
    { rootMargin: "600px" }
  );
  observer.observe(sentinel);

  renderNextPage();
}

/* ---------- search ---------- */
let allPosts = [];
const runSearch = createSearchRunner({
  getAll: () => allPosts,
  onResult: (list) => resetList(sortPosts(list)),
});

/* ---------- main ---------- */
async function main() {
  syncHeaderHeight();

  let posts;
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote("❌ posts_index.json の読み込みに失敗しました");
    return;
  }

  const ratings = await loadRatings();
  allPosts = posts.map((p) => {
    const scores = ratings[p.id] || [];
    const avg = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    return { ...p, avg, count: scores.length };
  });

  resetList(sortPosts(allPosts));
}

main();
