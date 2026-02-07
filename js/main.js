// /js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery } from "./latex.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js";
import { createSearchRunner } from "./search.js";

const timeline = document.getElementById("timeline");
if (!timeline) throw new Error("#timeline が見つかりません（index.html を確認）");

let sortMode = "year";
const PAGE_SIZE = 5;

let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;

const sentinel = document.createElement("div");
sentinel.style.height = "1px";

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

async function renderOne(p) {
  const ratedKey = `rated_${p.id}`;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");

  // 本文未ロードならロード
  await ensureBodyLoaded(p);

  texEl.innerHTML = p.html; // ensureBodyLoaded が html を用意する前提（posts.js側）

  // 平均難易度の色
  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  // 評価ボタン
  wireRatingButtons({ card, p, ratedKey, alreadyRated });

  timeline.appendChild(card);

  // MathJax
  if (window.MathJax) {
    try {
      await MathJax.startup.promise;
      await MathJax.typesetPromise([texEl]);
    } catch (e) {
      console.warn("MathJax typeset failed:", e);
    }
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

function resetList(newList) {
  currentList = newList.slice();
  rendered = 0;

  timeline.innerHTML = "";
  timeline.appendChild(sentinel);

  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) renderNextPage();
    },
    { rootMargin: "600px" }
  );

  observer.observe(sentinel);
  renderNextPage();
}

async function main() {
  // ヘッダー高さ同期
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  // posts index
  let posts;
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(timeline, `❌ posts_index.json の読み込みに失敗しました。<div class="muted">${String(e.message || e)}</div>`);
    return;
  }

  if (!posts.length) {
    showNote(
      timeline,
      "⚠️ posts が空です。<div class='muted'>posts_index.json を確認してください。</div>"
    );
    return;
  }

  // ratings
  const ratingMap = await loadRatings({ onWarn: (html) => showNote(timeline, html) });

  const enriched = posts.map((p) => {
    const scores = ratingMap[p.id] ?? [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { ...p, avg, count: scores.length, body: p.body || "", html: p.html || "" };
  });

  // 検索ランナー（search.js）
  const runSearch = createSearchRunner({
    getAll: () => enriched,
    normalizeQuery,
    ensureBodyLoaded,
  });

  // toolbar（検索欄を復活させる本体）
  const { sortBtn, searchInput } = buildToolbar(timeline, {
    onInput: async () => {
      const q = normalizeQuery(searchInput.value);
      if (!q) {
        resetList(sortPosts(enriched));
        return;
      }
      const result = await runSearch(q);
      resetList(sortPosts(result));
    },
    onSortToggle: () => {
      sortMode = sortMode === "year" ? "difficulty" : "year";
      sortBtn.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
      resetList(sortPosts(currentList));
    },
  });

  // 初期表示
  resetList(sortPosts(enriched));

  // フォント等でズレる対策
  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main();
