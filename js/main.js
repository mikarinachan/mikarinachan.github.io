import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery } from "./latex.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";
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
  if (!texEl) {
    console.warn("buildCard 内に .tex が無い", card);
    return;
  }

  // 本文ロード（例外で全体が止まらないように）
  try {
    await ensureBodyLoaded(p);
  } catch (e) {
    console.warn("本文ロード失敗:", p.tex, e);
    p.body = "（本文の読み込みに失敗しました）";
  }

  // buildCard が p.body を埋めてない想定なので、ここで反映
  texEl.innerHTML = p.bodyHTML || p.body || "";

  // avg色
  const avgDiv = card.querySelector("[data-avg]");
  if (avgDiv) applyAvgClass(avgDiv, p.avg);

  // 評価ボタン
  try {
    wireRatingButtons(card, p, ratedKey);
  } catch (e) {
    console.warn("wireRatingButtons 失敗:", e);
  }

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
  for (const p of next) {
    await renderOne(p);
  }
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
      if (entries.some((e) => e.isIntersecting)) {
        renderNextPage();
      }
    },
    { rootMargin: "600px" }
  );

  observer.observe(sentinel);
  renderNextPage();
}

async function main() {
  // toolbar
  const { toolbar, searchInput, clearBtn, sortToggle } = buildToolbar();
  timeline.before(toolbar);

  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(`❌ posts_index.json の読み込みに失敗しました<br><div class="muted">${String(e.message || e)}</div>`);
    return;
  }

  if (!posts.length) {
    showNote("⚠️ posts が空です（posts_index.json を確認）");
    return;
  }

  // ratings
  const ratingMap = await loadRatings();

  const enriched = posts.map((p) => {
    const scores = ratingMap[p.id] ?? [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { ...p, avg, count: scores.length };
  });

  resetList(sortPosts(enriched));

  // sort toggle
  sortToggle.onclick = () => {
    sortMode = sortMode === "year" ? "difficulty" : "year";
    sortToggle.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
    resetList(sortPosts(currentList));
  };

  // search
  const runSearch = createSearchRunner({
    normalizeQuery,
    ensureBodyLoaded,
    sortPosts,
    resetList,
  });

  searchInput.addEventListener("input", () => runSearch(enriched, searchInput.value));
  clearBtn.onclick = () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
  };

  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main().catch((e) => {
  console.error(e);
  showNote(`❌ 初期化でエラー<br><div class="muted">${String(e.message || e)}</div>`);
});
