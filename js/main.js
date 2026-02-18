// js/main.js
console.log("MAIN FINAL");

import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { latexBodyToSafeHTML } from "./latex.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js";
import { createSearchRunner } from "./search.js";

const timeline = document.getElementById("timeline");
if (!timeline) throw new Error("#timeline が見つかりません");

let sortMode = "year";
const PAGE_SIZE = 6;

let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;
let searchSeq = 0;

// ★ sentinel は必ず let（検索のたびに作り直す）
let sentinel = document.createElement("div");
sentinel.style.height = "1px";

/* =========================
   並び替え
========================= */
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

/* =========================
   1件描画
========================= */
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

/* =========================
   ページ描画
========================= */
async function renderNextPage() {
  if (isLoading) return;
  isLoading = true;

  const next = currentList.slice(rendered, rendered + PAGE_SIZE);
  for (const p of next) {
    await renderOne(p);
  }
  rendered += next.length;

  if (rendered >= currentList.length) {
    if (observer) observer.disconnect();
    observer = null;
  }

  isLoading = false;
}

/* =========================
   ★ 検索反映の要：完全リセット
========================= */
function resetList(list) {
  console.log("RESET LIST:", list.length);

  currentList = (list || []).filter(Boolean);
  rendered = 0;
  isLoading = false;

  // 既存 observer を必ず停止
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  // DOM を完全初期化
  timeline.innerHTML = "";

  // sentinel を作り直す（重要）
  sentinel = document.createElement("div");
  sentinel.style.height = "1px";
  timeline.appendChild(sentinel);

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        renderNextPage();
      }
    },
    { rootMargin: "800px" }
  );

  observer.observe(sentinel);

  // 初回即描画
  renderNextPage();
}

/* =========================
   util
========================= */
function debounce(fn, ms = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* =========================
   main
========================= */
async function main() {
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(timeline, "❌ posts_index.json の読み込みに失敗しました");
    return;
  }

  if (!posts.length) {
    showNote(timeline, "⚠️ データが空です");
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

  const { searchInput } = buildToolbar({
    timeline,
    onSortToggle: (btn) => {
      sortMode = sortMode === "year" ? "difficulty" : "year";
      btn.textContent =
        sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
      resetList(sortPosts(currentList));
    },
  });

  // 初期表示
  resetList(sortPosts(enriched));

  // 検索エンジン
  const runner = createSearchRunner({
    enriched,
    sortPosts,
    resetList,
    getSearchSeq: () => searchSeq,
  });

  const runSearch = debounce(async () => {
    const mySeq = ++searchSeq;
    await runner(searchInput.value, mySeq);
  }, 200);

  searchInput.addEventListener("input", runSearch);

  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main();

// ===== 利用方法モーダル =====
const openBtn = document.getElementById("openUsageBtn");
const closeBtn = document.getElementById("closeUsageBtn");
const modal = document.getElementById("usageModal");

if (openBtn && closeBtn && modal) {
  openBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });
}

