// render.js
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
  return UNIVERSITY_NAME_MAP[key] ?? source;
}

export function buildTags(p) {
  const tags = [];
  if (p && p.date) tags.push(p.date);

  if (p && p.source) {
    const parts = String(p.source)
      .replace(/[｜|・]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    for (const t of parts.slice(0, 4)) tags.push(t);
  }

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
    .map((t) => '<span class="tag">' + escapeHTML(t) + "</span>")
    .join("");

  const uni = escapeHTML(displayUniversityName(p && p.source));
  const year = escapeHTML((p && p.date) ? p.date : "");
  const qnum = (p && p.no) ? String(p.no) : "";

  const headRight = qnum ? '<div class="qnum">第' + escapeHTML(qnum) + "問</div>" : "";

  const explainHtml =
    p && p.explain ? '<div class="explain">解説：' + escapeHTML(p.explain) + "</div>" : "";

  const answerHtml =
    p && p.answer
      ? '<div class="answer"><a href="' +
        p.answer +
        '" target="_blank" rel="noopener">▶ 模範解答を見る</a></div>'
      : "";

  const avgText = p && p.count ? Number(p.avg).toFixed(2) : "未評価";
  const countText = p && p.count ? "（" + p.count + "人）" : "";

  const ratingButtonsHtml = [1,2,3,4,5,6,7,8,9,10]
    .map((n) => {
      const dis = alreadyRated ? "disabled" : "";
      return '<button data-score="' + n + '" ' + dis + ">" + n + "</button>";
    })
    .join("");

  div.innerHTML =
    '<div class="problem-head">' +
      '<div class="problem-info">' + uni + (year ? " " + year + "年度" : "") + "</div>" +
      headRight +
    "</div>" +
    '<div class="tags">' + tagsHtml + "</div>" +
    '<div class="content"><div class="tex"></div></div>' +
    explainHtml +
    answerHtml +
    '<div class="avg" data-avg>' +
      "<span>平均難易度：</span>" +
      '<span class="avg-badge"><b>' + avgText + "</b>" + countText + "</span>" +
    "</div>" +
    '<div class="rating">' + ratingButtonsHtml + "</div>";

  return div;
}

/** 呼び方を両対応にする */
export async function wireRatingButtons(arg1, arg2) {
  let card, p;
  if (arg1 && typeof arg1 === "object" && arg1.card) {
    card = arg1.card;
    p = arg1.p;
  } else {
    card = arg1;
    p = arg2;
  }

  if (!card || !(p && p.id)) return;

  const ratedKey = "rated_" + p.id;
  const avgDiv = card.querySelector("[data-avg]");

  card.querySelectorAll("button[data-score]").forEach((btn) => {
    btn.onclick = async () => {
      if (localStorage.getItem(ratedKey)) return;

      const score = Number(btn.dataset.score);
      try {
        await submitRating(p.id, score);
      } catch (e) {
        console.error(e);
        alert("評価の送信に失敗しました");
        return;
      }

      const prevAvg = Number(p.avg || 0);
      const prevCount = Number(p.count || 0);
      const newAvg = (prevAvg * prevCount + score) / (prevCount + 1);

      p.avg = newAvg;
      p.count = prevCount + 1;

      if (avgDiv) {
        avgDiv.innerHTML =
          "<span>平均難易度：</span>" +
          '<span class="avg-badge"><b>' +
          newAvg.toFixed(2) +
          "</b>（" +
          p.count +
          "人）</span>";
        applyAvgClass(avgDiv, newAvg);
      }

      localStorage.setItem(ratedKey, String(score));
      card.querySelectorAll("button[data-score]").forEach((b) => (b.disabled = true));
      btn.classList.add("selected");
    };
  });
}
