// js/render.js
import { escapeHTML } from "./latex.js";
import { submitRating } from "./firebase.js";

/* 表示用 大学名マップ */
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
  return UNIVERSITY_NAME_MAP[key] || source;
}

export function buildTags(p) {
  const tags = [];
  if (p && p.date) tags.push(p.date);
  if (p && p.source) tags.push(p.source);
  if (p && p.no) tags.push("第" + p.no + "問");
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
    .map(t => '<span class="tag">' + escapeHTML(t) + '</span>')
    .join("");

  const uni = escapeHTML(displayUniversityName(p && p.source));
  const year = escapeHTML(p && p.date ? p.date : "");
  const qnum = p && p.no ? "第" + p.no + "問" : "";

  div.innerHTML =
    '<div class="problem-head">' +
      '<div class="problem-info">' +
        uni + (year ? " " + year + "年度" : "") +
      '</div>' +
      (qnum ? '<div class="qnum">' + qnum + '</div>' : "") +
    '</div>' +
    '<div class="tags">' + tagsHtml + '</div>' +
    '<div class="content"><div class="tex"></div></div>' +
    '<div class="avg" data-avg>' +
      '<span>平均難易度：</span>' +
      '<span class="avg-badge"><b>' +
        (p && p.count ? Number(p.avg).toFixed(2) : "未評価") +
      '</b>' +
      (p && p.count ? "（" + p.count + "人）" : "") +
      '</span>' +
    '</div>' +
    '<div class="rating">' +
      [1,2,3,4,5,6,7,8,9,10].map(n =>
        '<button data-score="' + n + '" ' +
        (alreadyRated ? "disabled" : "") +
        '>' + n + '</button>'
      ).join("") +
    '</div>';

  return div;
}

export async function wireRatingButtons({ card, p }) {
  if (!card || !p || !p.id) return;

  const ratedKey = "rated_" + p.id;
  const avgDiv = card.querySelector("[data-avg]");

  card.querySelectorAll("button[data-score]").forEach(btn => {
    btn.onclick = async () => {
      if (localStorage.getItem(ratedKey)) return;

      const score = Number(btn.dataset.score);
      await submitRating(p.id, score);

      const newAvg = (p.avg * p.count + score) / (p.count + 1);
      p.count += 1;
      p.avg = newAvg;

      avgDiv.innerHTML =
        '<span>平均難易度：</span>' +
        '<span class="avg-badge"><b>' +
        newAvg.toFixed(2) +
        '</b>（' + p.count + '人）</span>';

      applyAvgClass(avgDiv, newAvg);
      localStorage.setItem(ratedKey, score);

      card.querySelectorAll("button").forEach(b => b.disabled = true);
    };
  });
}
