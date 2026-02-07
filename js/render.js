import { escapeHTML } from "./latex.js";
import { submitRating } from "./firebase.js";

export function buildTags(p) {
  const tags = [];
  if (p.date) tags.push(p.date);
  if (p.source) {
    const parts = String(p.source).replace(/[｜|・]/g, " ").split(/\s+/).filter(Boolean);
    for (const t of parts.slice(0, 4)) tags.push(t);
  }
  if (p.no) tags.push(`第${p.no}問`);
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

  const tagsHtml = buildTags(p).map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join("");

  div.innerHTML = `
    <div class="meta">${escapeHTML(p.date)}｜${escapeHTML(p.source)}</div>
    <div class="tags">${tagsHtml}</div>
    <div class="content"><div class="tex"></div></div>
    ${p.explain ? `<div class="explain">解説：${escapeHTML(p.explain)}</div>` : ""}
    ${
      p.answer
        ? `<div class="answer"><a href="${p.answer}" target="_blank" rel="noopener">▶ 模範解答を見る</a></div>`
        : ""
    }
    <div class="avg" data-avg>
      <span>平均難易度：</span>
      <span class="avg-badge">
        <b>${p.count ? Number(p.avg).toFixed(2) : "未評価"}</b>
        ${p.count ? `（${p.count}人）` : ""}
      </span>
    </div>
    <div class="rating">
      ${[1,2,3,4,5,6,7,8,9,10].map((n)=>`<button data-score="${n}" ${alreadyRated?"disabled":""}>${n}</button>`).join("")}
    </div>
  `;
  return div;
}

export async function wireRatingButtons({ card, p }) {
  const ratedKey = `rated_${p.id}`;
  const avgDiv = card.querySelector("[data-avg]");

  card.querySelectorAll("button[data-score]").forEach((btn) => {
    btn.onclick = async () => {
      if (localStorage.getItem(ratedKey)) return;

      const score = Number(btn.dataset.score);
      try {
        await submitRating(p.id, score);
      } catch (e) {
        console.error(e);
        alert("評価の送信に失敗しました（権限/通信）。Console を確認してください。");
        return;
      }

      const prevAvg = Number(p.avg || 0);
      const prevCount = Number(p.count || 0);
      const newAvg = (prevAvg * prevCount + score) / (prevCount + 1);

      p.avg = newAvg;
      p.count = prevCount + 1;

      avgDiv.innerHTML = `
        <span>平均難易度：</span>
        <span class="avg-badge"><b>${newAvg.toFixed(2)}</b>（${p.count}人）</span>
      `;
      applyAvgClass(avgDiv, newAvg);

      localStorage.setItem(ratedKey, String(score));
      card.querySelectorAll("button[data-score]").forEach((b) => (b.disabled = true));
      btn.classList.add("selected");
    };
  });
}

