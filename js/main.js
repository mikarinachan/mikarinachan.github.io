// js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery, latexBodyToSafeHTML } from "./latex.js";
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
    arr.sort((a, b) => (Number(b.avg || 0) - Number(a.avg || 0)));
  } else {
    arr.sort((a, b) => {
      const d = String(b.date || "").localeCompare(String(a.date || ""));
      if (d !== 0) return d;
      return Number(a.no || 0) - Number(b.no || 0);
    });
  }
  return arr;
}

async function renderOne(p) {
  const ratedKey = `rated_${p.id}`;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");

  // 本文ロード（必要なときだけ）
  await ensureBodyLoaded(p);

  // 表示用HTMLへ（escape→QNUM復元までやる）
  texEl.innerHTML = latexBodyToSafeHTML(p.body || "");

  // avg色
  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  // ratingボタン
  await wireRatingButtons({ card, p });

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
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(timeline, `❌ posts_index.json の取得に失敗しました。<div class="muted">${String(e.message || e)}</div>`);
    return;
  }

  if (posts.length === 0) {
    showNote(
      timeline,
      "⚠️ posts/ に対象ファイルが見つかりません。<div class='muted'>posts_index.json を確認してください。</div>"
    );
    return;
  }

  // 難易度ロード
  const ratingMap = await loadRatings();

  const enriched = posts.map((p) => {
    const scores = ratingMap[p.id] ?? [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { ...p, avg, count: scores.length };
  });

  // toolbar
  const { searchInput, sortToggle } = buildToolbar(timeline, {
    onSortToggle: () => {
      sortMode = sortMode === "year" ? "difficulty" : "year";
      sortToggle.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
      resetList(sortPosts(currentList));
    },
  });

  // 初期表示
  resetList(sortPosts(enriched));

  // 検索（search.js に委譲）
  const runSearch = createSearchRunner({
    enriched,
    ensureBodyLoaded,
    sortPosts,
    resetList,
  });

  searchInput.addEventListener("input", () => runSearch(normalizeQuery(searchInput.value)));

  // header高さを再同期（フォントロード等でズレる対策）
  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main();
