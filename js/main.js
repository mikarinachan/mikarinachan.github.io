// js/main.js
console.log("MAIN 1800"); // ★ここがConsoleに出たら新mainが動いてる証拠

import { loadPostIndex, ensureBodyLoaded } from "./posts.js?v=20260207_1800";
import { loadRatings } from "./firebase.js?v=20260207_1800";
import { latexBodyToSafeHTML } from "./latex.js?v=20260207_1800";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js?v=20260207_1800";
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js?v=20260207_1800";
import { createSearchRunner } from "./search.js?v=20260207_1800";

const timeline = document.getElementById("timeline");
if (!timeline) throw new Error("#timeline が見つかりません");

let sortMode = "year";
const PAGE_SIZE = 6;

let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;

let searchSeq = 0;

const sentinel = document.createElement("div");
sentinel.style.height = "1px";

function sortPosts(list) {
  const arr = (list || []).slice();
  if (sortMode === "difficulty") {
    arr.sort((a, b) => (Number(b.avg) || 0) - (Number(a.avg) || 0));
  } else {
    arr.sort((a, b) => {
      const d = String(b.date || "").localeCompare(String(a.date || ""));
      if (d !== 0) return d;
      return (Number(a.no) || 0) - (Number(b.no) || 0);
    });
  }
  return arr;
}

async function renderOne(p) {
  if (!p) return;

  const ratedKey = "rated_" + p.id;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");

  try {
    await ensureBodyLoaded(p);
  } catch {
    p.body = "";
  }

  texEl.innerHTML = latexBodyToSafeHTML(p.body || "");

  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  await wireRatingButtons({ card, p });
  timeline.appendChild(card);

  if (window.MathJax) {
    try {
      await MathJax.typesetPromise([texEl]);
    } catch {}
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
    if (observer) observer.disconnect();
  }
  isLoading = false;
}

function resetList(list) {
  currentList = (list || []).filter(Boolean);
  rendered = 0;

  timeline.innerHTML = "";
  timeline.appendChild(sentinel);

  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) renderNextPage();
    },
    { rootMargin: "800px" }
  );
  observer.observe(sentinel);

  renderNextPage();
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function main() {
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(timeline, "❌ posts_index.json の読み込みに失敗しました");
    return;
  }

  const ratingMap = await loadRatings();

  const enriched = posts
    .filter((p) => p && p.id && p.tex)
    .map((p) => {
      const scores = ratingMap[p.id] || [];
      const avg = scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
      return { ...p, avg, count: scores.length };
    });

  const ui = buildToolbar({
    timeline,
    onSortToggle: (btn) => {
      sortMode = sortMode === "year" ? "difficulty" : "year";
      btn.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
      resetList(sortPosts(currentList));
    },
  });

  resetList(sortPosts(enriched));

  // ★ search.js を必ず使う
  const runner = createSearchRunner({
    enriched,
    sortPosts,
    resetList,
    getSearchSeq: () => searchSeq,
  });

  const runSearch = debounce(async () => {
    const mySeq = ++searchSeq;
    // ★ normalizeしない（カンマ分割 / LaTeX正規化は search.js 側）
    await runner(ui.searchInput.value, mySeq);
  }, 200);

  ui.searchInput.addEventListener("input", runSearch);

  requestAnimationFrame(syncHeaderHeight);
}

main();
