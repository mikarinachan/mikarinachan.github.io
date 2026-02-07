// js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery, latexBodyToSafeHTML } from "./latex.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js";

const timeline = document.getElementById("timeline");
if (!timeline) throw new Error("#timeline が見つかりません");

let sortMode = "year";
const PAGE_SIZE = 6;

let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;

const sentinel = document.createElement("div");
sentinel.style.height = "1px";

function sortPosts(list) {
  const arr = list.slice();
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
  if (!p) return; // ★ここ重要：undefinedが混じっても落とさない

  const ratedKey = `rated_${p.id}`;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");

  // 本文をロード（検索に引っかかったやつも含め）
  await ensureBodyLoaded(p);

  // 本文をDOMに入れる（MathJax用に安全なHTMLへ）
  texEl.innerHTML = latexBodyToSafeHTML(p.body || "");

  // 難易度色
  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  // 評価ボタン（ここで p undefined にならないように）
  await wireRatingButtons({ card, p });

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
  currentList = newList.filter(Boolean); // ★undefined混入対策
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
    { rootMargin: "800px" }
  );

  observer.observe(sentinel);
  renderNextPage();
}

// ---- 検索（速くする：debounce + 中断 + 並列ロード） ----
let searchSeq = 0;
function debounce(fn, ms = 200) {
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
    showNote(
      timeline,
      `❌ posts_index.json の読み込みに失敗しました。<div class="muted">${String(e.message || e)}</div>`
    );
    return;
  }

  if (!posts.length) {
    showNote(
      timeline,
      "⚠️ posts/ に対象ファイルが見つかりません。<div class='muted'>posts_index.json を確認してください。</div>"
    );
    return;
  }

  const ratingMap = await loadRatings();

  const enriched = posts
    .filter((p) => p && p.id && p.tex)
    .map((p) => {
      const scores = ratingMap[p.id] ?? [];
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { ...p, avg, count: scores.length };
    });

  // ツールバー
  const { searchInput, sortToggle } = buildToolbar({
    timeline,
    onSortToggle: (btn) => {
      sortMode = sortMode === "year" ? "difficulty" : "year";
      btn.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
      resetList(sortPosts(currentList));
    },
  });

  // 初期表示
  resetList(sortPosts(enriched));

  // 検索
  const runSearch = debounce(async () => {
    const mySeq = ++searchSeq;
    const q = normalizeQuery(searchInput.value);

    if (!q) {
      resetList(sortPosts(enriched));
      return;
    }

    // メタ一致（速い）
    const metaMatched = enriched.filter((p) => {
      const meta = normalizeQuery(`${p.date}_${p.no} ${p.source} ${p.id}`);
      return meta.includes(q);
    });

    // 本文一致（未ロードは並列で少しずつロード）
    const bodyMatched = [];
    const CONCURRENCY = 6;

    let i = 0;
    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];
        if (mySeq !== searchSeq) return;

        await ensureBodyLoaded(p); // キャッシュされる前提
        if (normalizeQuery(p.body || "").includes(q)) bodyMatched.push(p);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (mySeq !== searchSeq) return;

    // マージ（重複排除）
    const merged = [];
    const seen = new Set();
    for (const p of [...metaMatched, ...bodyMatched]) {
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    resetList(sortPosts(merged));
  }, 200);

  searchInput.addEventListener("input", runSearch);

  // header高さズレ対策
  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main();
