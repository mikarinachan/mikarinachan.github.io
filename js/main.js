// js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js";
import { createSearchRunner } from "./search.js";

const timeline = document.getElementById("timeline");
if (!timeline) throw new Error("#timeline が見つかりません");

/* ---------- state ---------- */
let sortMode = "year"; // "year" | "difficulty"
const PAGE_SIZE = 5;

let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;

const sentinel = document.createElement("div");
sentinel.style.height = "1px";

/* ---------- sort ---------- */
function sortPosts(list) {
  const arr = list.slice();

  if (sortMode === "difficulty") {
    arr.sort((a, b) => (b.avg || 0) - (a.avg || 0));
  } else {
    // 年度降順 → 問題番号昇順
    arr.sort((a, b) => {
      const d = String(b.date || "").localeCompare(String(a.date || ""));
      if (d !== 0) return d;
      return (a.no || 0) - (b.no || 0);
    });
  }
  return arr;
}

/* ---------- render one card ---------- */
async function renderOne(p) {
  const ratedKey = `rated_${p.id}`;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");

  // 本文ロード（未ロードならロード）
  try {
    await ensureBodyLoaded(p);
  } catch (e) {
    console.warn("本文ロード失敗:", p?.tex, e);
    // ここで落とすと表示が止まるので、最低限の文言を入れる
    p.body = p.body || "（本文の読み込みに失敗しました）";
  }

  // 本文をDOMへ（render.js側で escape/QNUM などやってる想定ならそっちで）
  // ここでは最小：render.jsに「texへ本文を流し込む関数」が無い前提なので直接
  texEl.innerHTML = p.renderedHtml || p.bodyHtml || p.body || "";

  // 平均表示色
  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  // レーティングボタン配線（Firestore送信 + localStorage など）
  wireRatingButtons({ card, p, ratedKey });

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

/* ---------- paging ---------- */
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

/* ---------- main ---------- */
async function main() {
  // UI
  const { toolbar, searchInput, sortToggle, clearBtn } = buildToolbar();
  timeline.before(toolbar);

  // header高さ同期
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  // posts index
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(
      `❌ posts_index.json の読み込みに失敗しました。<div class="muted">${String(e.message || e)}</div>`
    );
    return;
  }

  if (!posts.length) {
    showNote(
      "⚠️ posts/ に対象ファイルが見つかりません。<div class='muted'>ファイル名は <b>2025_6.tex</b> のように <b>YYYY_N.tex</b> 形式にしてください。</div>"
    );
    return;
  }

  // ratings
  const ratingMap = await loadRatings();

  // enrich
  const enriched = posts.map((p) => {
    const scores = ratingMap[p.id] ?? [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { ...p, avg, count: scores.length };
  });

  // 初期表示
  resetList(sortPosts(enriched));

  // sort toggle
  sortToggle.onclick = () => {
    sortMode = sortMode === "year" ? "difficulty" : "year";
    sortToggle.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
    resetList(sortPosts(currentList));
  };

  // clear
  clearBtn.onclick = () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
  };

  // search (遅い/出ない対策：ensureBodyLoaded を search.js が内部で使う)
  let searchSeq = 0;

  const runSearch = createSearchRunner({
    enriched,
    sortPosts,
    resetList,
    getSearchSeq: () => searchSeq,
  });

  searchInput.addEventListener("input", async () => {
    const mySeq = ++searchSeq;
    await runSearch(searchInput.value, mySeq);
  });

  // header高さ再同期（フォントロード等のズレ対策）
  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main();
