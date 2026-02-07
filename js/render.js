// js/render.js
import { escapeHTML } from "./latex.js";
import { submitRating } from "./firebase.js";

/* ===============================
   表示用 大学名マップ（最速修正）
================================ */
const UNIVERSITY_NAME_MAP = {
  titech: "東京科学大学",
  tokyo: "東京大学",
  kyoto: "京都大学",
  osaka: "大阪大学",
  tohoku: "東北大学",
  hokkaido: "北海道大学",
  nagoya: "名古屋大学",
  kyushu: "九州大学",
};

function displayUniversityName(source) {
  if (!source) return "";
  const key = String(source).toLowerCase();
  return UNIVERSITY_NAME_MAP[key] ?? source;
}

/* =============================== */

export function buildTags(p) {
  const tags = [];
  if (p?.date) tags.push(p.date);

  if (p?.source) {
    const parts = String(p.source)
      .replace(/[｜|・]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    for (const t of parts.slice(0, 4)) tags.push(t);
  }

  if (p?.no) tags.push(`第${p.no}問`);
  return Array.from(new Set(tags)).slice(0, 6);
}

export function applyAvgClass(avgDiv, avg) {
  avgDiv.classList.remove("low", "mid", "high");
  if (!Number.isFinite(avg) || avg <= 0) return;
  if (avg < 4) avgDiv.classList.add("low");
  else if (avg < 7) avgDiv.classList.add("mid");
  else avgDiv.classList.add("high");
}

export function buildCard(p, alreadyRated) {
  const div = document.createElement("div");
  div.className = "post";

  const tagsHtml = buildTags(p)
    .map((t) => `<span class="tag">${escapeHTML(t)}</span>`)
    .join("");

  // ★ ここが修正ポイント
  const uni = escapeHTML(displayUniversityName(p?.source));
  const year = escapeHTML(p?.date ?? "");
  const qnum = p?.no ? String(p.no) : "";

  div.innerHTML = `
    <div class="problem-head">
      <div class="problem-info">
