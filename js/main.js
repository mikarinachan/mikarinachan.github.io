// js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery, latexBodyToSafeHTML } from "./latex.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";

// ★ render.js もキャッシュ破壊（ここ超重要）
import { buildCard, applyAvgClass, wireRatingButtons } from "./render.js?v=20260207";

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
  } catch (e) {
    console.warn("本文ロード失敗:", p && p.tex, e);
    p.body = p.body || "";
  }

  texEl.innerHTML = latexBodyToSafeHTML(p.body || "");

  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  await wireRatingButtons({ card, p });

  timeline.appendChild(card);

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
  for (let i = 0; i < next.length; i++) {
    await renderOne(next[i]);
  }
  rendered += next.length;

  if (rendered >= currentList.length) {
    sentinel.remove();
    if (observer) observer.disconnect();
  }

  isLoading = false;
}

function resetList(newList) {
  currentList = (newList || []).filter(Boolean);
  rendered = 0;

  timeline.innerHTML = "";
  timeline.appendChild(sentinel);

  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    async (entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          await renderNextPage();
          break;
        }
      }
    },
    { rootMargin: "800px" }
  );

  observer.observe(sentinel);
  renderNextPage();
}

// ---- 検索（debounce + 中断 + 並列ロード） ----
let searchSeq = 0;
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
    showNote(timeline, "❌ posts_index.json の読み込みに失敗しました。Console を確認してください。");
    return;
  }

  if (!posts || !posts.length) {
    showNote(timeline, "⚠️ posts_index.json が空です。");
    return;
  }

  const ratingMap = await loadRatings();

  const enriched = posts
    .filter((p) => p && p.id && p.tex)
    .map((p) => {
      const scores = ratingMap[p.id] || [];
      const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { ...p, avg, count: scores.length };
    });

  cons
