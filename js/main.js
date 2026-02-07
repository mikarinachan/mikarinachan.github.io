// js/main.js
import { loadPostIndex, ensureBodyLoaded } from "./posts.js";
import { loadRatings } from "./firebase.js";
import { normalizeQuery, latexBodyToSafeHTML } from "./latex.js";
import { buildToolbar, showNote, syncHeaderHeight } from "./ui.js";

/* ★ キャッシュ破壊付き render.js を読む */
import {
  buildCard,
  applyAvgClass,
  wireRatingButtons,
} from "./render.js?v=20260207";

const timeline = document.getElementById("timeline");
if (!timeline) throw new Error("#timeline not found");

let sortMode = "year";
let currentList = [];

async function renderAll(list) {
  timeline.innerHTML = "";
  for (const p of list) {
    const rated = localStorage.getItem("rated_" + p.id);
    const card = buildCard(p, rated);

    const texEl = card.querySelector(".tex");

    try {
      await ensureBodyLoaded(p);
      texEl.innerHTML = latexBodyToSafeHTML(p.body || "");
    } catch (e) {
      texEl.textContent = "本文の読み込みに失敗しました";
    }

    applyAvgClass(card.querySelector("[data-avg]"), p.avg);
    await wireRatingButtons({ card, p });

    timeline.appendChild(card);

    if (window.MathJax) {
      await MathJax.typesetPromise([texEl]);
    }
  }
}

async function main() {
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    showNote(timeline, "posts_index.json の読み込みに失敗しました");
    throw e;
  }

  const ratingMap = await loadRatings();

  const enriched = posts.map((p) => {
    const scores = ratingMap[p.id] || [];
    const avg
