// js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery } from "./latex.js";
import {
  buildToolbar,
  showNote,
  syncHeaderHeight,
  attachGlobalErrorBanner,
} from "./ui.js";
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js";
import { createSearchRunner } from "./search.js";

const timeline = document.getElementById("timeline");
if (!timeline) throw new Error("#timeline が見つかりません");

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

  // 本文ロード（必要なら）
  await ensureBodyLoaded(p);

  // 表示
  texEl.innerHTML = p.html || "";

  // avg色
  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  // 評価ボタン
  wireRatingButtons(card, p, ratedKey);

  timeline.appendChild(card);

  // 追加分だけMathJax
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
    async (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        await renderNextPage();
      }
    },
    { rootMargin: "600px" }
  );

  observer.observe(sentinel);
  renderNextPage();
}

async function main() {
  // ツールバー生成（ここで timeline を渡すのが重要）
  const { searchInput, clearBtn, sortToggle } = buildToolbar(timeline);

  // 画面上エラーバナー（任意）
  attachGlobalErrorBanner(timeline);

  // header高さ同期
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);
  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);

  // posts
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(
      timeline,
      `❌ posts_index.json の読み込みに失敗しました。<div class="muted">${String(
        e.message || e
      )}</div>`
    );
    return;
  }

  if (!posts.length) {
    showNote(
      timeline,
      "⚠️ posts がありません。<div class='muted'>posts_index.json を確認してください。</div>"
    );
    return;
  }

  // ratings
  const ratingMap = await loadRatings();

  const enriched = posts.map((p) => {
    const scores = ratingMap[p.id] ?? [];
    const avg = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    return {
      ...p,
      avg,
      count: scores.length,
    };
  });

  // 初期表示
  resetList(sortPosts(enriched));

  // 並び替え
  sortToggle.onclick = () => {
    sortMode = sortMode === "year" ? "difficulty" : "year";
    sortToggle.textContent =
      sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
    resetList(sortPosts(currentList));
  };

  // クリア
  clearBtn.onclick = () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
  };

  // 検索（search.js側に実装を委譲）
  const runSearch = createSearchRunner({
    normalizeQuery,
    ensureBodyLoaded,
    sortPosts: (list) => sortPosts(list),
    resetList: (list) => resetList(list),
    enriched,
  });

  searchInput.addEventListener("input", () => runSearch(searchInput.value));
}

main().catch((e) => {
  console.error(e);
  showNote(
    timeline,
    `❌ 起動に失敗しました。<div class="muted">${String(e.message || e)}</div>`
  );
});
