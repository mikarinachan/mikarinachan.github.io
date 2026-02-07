// app.js
// =======================================================
// 受験数学難問発掘会 - フロント
// - posts_index.json を読み込み
// - 各 .tex をエンコード考慮して fetch → normalize → MathJax 表示
// - Firestore ratings の平均/人数表示、投票
// - 検索（メタ + 本文） / 並び替え / 無限スクロール
// =======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =======================================================
 * 0) util: encoding付き fetch（auto対応 / SJISフォールバック）
 * ======================================================= */
async function fetchTextWithEncoding(url, encoding = "auto") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);

  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);

  const enc = String(encoding || "auto").toLowerCase();

  // Shift_JIS 変換（encoding-japanese があればそれ優先、なければ TextDecoder を試す）
  const decodeSJIS = () => {
    if (window.Encoding) {
      return window.Encoding.convert(bytes, {
        to: "UNICODE",
        from: "CP932",
        type: "string",
      });
    }
    // ない場合も落とさずに頑張る（環境によっては shift_jis が通る）
    try {
      return new TextDecoder("shift_jis").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  };

  // UTF-8 変換（厳格：壊れてたら例外）
  const decodeUTF8Strict = () => {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  };

  // 1) 明示指定があるなら優先
  if (enc === "utf-8" || enc === "utf8") return new TextDecoder("utf-8").decode(bytes);
  if (enc === "shift_jis" || enc === "shift-jis" || enc === "sjis") return decodeSJIS();

  // 2) auto: UTF-8 を厳格に試してダメなら SJIS
  if (enc === "auto") {
    try {
      return decodeUTF8Strict();
    } catch {
      return decodeSJIS();
    }
  }

  // 3) その他: 指定 TextDecoder を試す / ダメならUTF-8
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/* =======================================================
 * 1) Firebase
 * ======================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCfyTtuLXAmibDu2ebKSTUI-_ZKFrv8Syo",
  authDomain: "math-memo-870c0.firebaseapp.com",
  projectId: "math-memo-870c0",
  storageBucket: "math-memo-870c0.firebasestorage.app",
  messagingSenderId: "396039327636",
  appId: "1:396039327636:web:028aa61574d06623240981",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =======================================================
 * 2) DOM / 状態
 * ======================================================= */
const timeline = document.getElementById("timeline");
if (!timeline) {
  throw new Error("#timeline が見つかりません（index.html を確認）");
}

let sortMode = "year"; // "year" | "difficulty"
const PAGE_SIZE = 5;

let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;

let searchSeq = 0;          // 検索のキャンセル用
let searchTimer = null;     // デバウンス用（軽く）

const sentinel = document.createElement("div");
sentinel.style.height = "1px";

/* =======================================================
 * 3) UI: header高さ同期
 * ======================================================= */
function syncHeaderHeight() {
  const h = document.querySelector("header")?.offsetHeight || 72;
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}
window.addEventListener("resize", syncHeaderHeight);

/* =======================================================
 * 4) UI: Toolbar (search / clear / sort)
 * ======================================================= */
const toolbar = document.createElement("div");
toolbar.className = "toolbar";

const toolbarInner = document.createElement("div");
toolbarInner.className = "toolbar-inner";

const searchInput = document.createElement("input");
searchInput.type = "search";
searchInput.placeholder = "検索（例: 2025 / 6 / 複素数 / Re / 4a+1 など）";
searchInput.autocomplete = "off";

const clearBtn = document.createElement("button");
clearBtn.textContent = "クリア";
clearBtn.onclick = () => {
  searchInput.value = "";
  searchInput.dispatchEvent(new Event("input"));
};

const sortToggle = document.createElement("button");
sortToggle.textContent = "並び順：年度順";

toolbarInner.appendChild(searchInput);
toolbarInner.appendChild(clearBtn);
toolbarInner.appendChild(sortToggle);
toolbar.appendChild(toolbarInner);

timeline.before(toolbar);
syncHeaderHeight();

/* =======================================================
 * 5) UI note
 * ======================================================= */
function showNote(html) {
  const div = document.createElement("div");
  div.className = "system-note";
  div.innerHTML = html;
  timeline.prepend(div);
}

/* =======================================================
 * 6) util
 * ======================================================= */
function escapeHTML(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeQuery(q) {
  return (q || "").trim().toLowerCase().normalize("NFKC");
}

// 旧問フォルダが SJIS っぽい時の推測（必要なら増減）
function guessEncoding(path) {
  const p = String(path || "");
  const sjisPrefixes = [
    "posts/01_tokyo/",
    "posts/02_kyoto/",
    "posts/03_hokudai/",
    "posts/04_tohoku/",
    "posts/05_nagoya/",
    "posts/06_osaka/",
    "posts/07_kyushu/",
    "posts/08_titech/",
  ];
  if (sjisPrefixes.some((prefix) => p.startsWith(prefix))) return "shift_jis";
  return "utf-8";
}

/* =======================================================
 * 7) LaTeX normalize（MathJaxで死にやすいものを剥がす）
 * ======================================================= */
function normalizeLatexForMathJax(tex) {
  return String(tex ?? "")
    .replace(/\\hspace\*?\{[^}]*\}/g, "")
    .replace(/\\vspace\*?\{[^}]*\}/g, "")
    .replace(/\\(smallskip|medskip|bigskip)\b/g, "")
    .replace(/\\(noindent|par|indent)\b/g, "\n")
    .replace(/\\(newpage|clearpage|pagebreak|linebreak)\b(\[[^\]]*\])?/g, "\n")
    .replace(/\\(qquad|quad)\b/g, " ")
    .replace(/\\,/g, " ")

    .replace(/\\setlength\{[^}]+\}\{[^}]+\}/g, "")
    .replace(/\\addtolength\{[^}]+\}\{[^}]+\}/g, "")
    .replace(
      /\\(textwidth|textheight|oddsidemargin|evensidemargin|topmargin|headheight|headsep|footskip)\s*=?\s*[^\\\n]*/g,
      ""
    )

    .replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\input\{[^}]*\}/g, "")
    .replace(/\\include\{[^}]*\}/g, "")
    .replace(/\\bibliography\{[^}]*\}/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}/g, "")

    .replace(/\\begin\{(tikzpicture|picture|pspicture|circuitikz)\}[\s\S]*?\\end\{\1\}/g, "")

    .replace(/\\raisebox\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\(phantom|hphantom|vphantom)\{[^}]*\}/g, "")

    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\color\{[^}]*\}/g, "")

    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "")
    .replace(/\\cite\{[^}]*\}/g, "")

    .replace(/^[\s\S]*?\\begin\{document\}/, "")
    .replace(/\\end\{document\}[\s\S]*$/, "")

    .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\pagestyle\{[^}]+\}/g, "")

    .replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, "")

    .replace(/\\begin\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\end\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\begin\{(?:description|itemize|enumerate)\}/g, "\n")
    .replace(/\\end\{(?:description|itemize|enumerate)\}/g, "\n")

    .replace(/\\item\s*\[\s*\(([^)]+)\)\s*\]\s*/g, "\n（$1） ")
    .replace(/\\item\s*\[\s*([^\]]+)\s*\]\s*/g, "\n$1： ")
    .replace(/\\item\b\s*/g, "\n・ ")

    .replace(/^\s*\{(\d+)\}\s*$/gm, "[[QNUM:$1]]")
    .replace(/\{\s*\\huge\s+(\d+)\s*\}/g, "[[QNUM:$1]]")

    .replace(/\u3000+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* =======================================================
 * 8) posts index
 * ======================================================= */
async function loadPostIndex() {
  const r = await fetch("posts_index.json", { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}: posts_index.json`);
  const posts = await r.json();

  const cleaned = (posts || [])
    .filter((p) => p && p.id && p.tex)
    .map((p) => {
      const texPath = String(p.tex);
      const enc = String(p.encoding ?? "auto");
      return {
        id: String(p.id),
        tex: texPath,
        date: String(p.date ?? ""),
        no: Number(p.no ?? 0),
        source: String(p.source ?? "入試問題"),
        encoding: enc === "auto" ? guessEncoding(texPath) : enc, // autoなら推測で補助（不要なら enc をそのままにしてOK）
        explain: String(p.explain ?? ""),
        answer: String(p.answer ?? ""),
        body: "", // lazily load
      };
    });

  cleaned.sort((a, b) => b.date.localeCompare(a.date) || a.no - b.no);
  return cleaned;
}

/* =======================================================
 * 9) ratings
 * ======================================================= */
async function loadRatings() {
  let ratingMap = {};
  try {
    const snap = await getDocs(collection(db, "ratings"));
    snap.forEach((doc) => {
      const { postId, score } = doc.data() || {};
      if (!postId || typeof score !== "number") return;
      (ratingMap[postId] ??= []).push(score);
    });
  } catch (e) {
    console.warn("ratings 読み取り失敗（権限など）:", e);
    ratingMap = {};
    showNote(
      "⚠️ 難易度データ（Firestore）が読み取れませんでした。表示は続行します。<div class='muted'>Console に詳細があります。</div>"
    );
  }
  return ratingMap;
}

/* =======================================================
 * 10) tags / avg色
 * ======================================================= */
function buildTags(p) {
  const tags = [];
  if (p.date) tags.push(p.date);

  if (p.source) {
    const parts = String(p.source)
      .replace(/[｜|・]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    for (const t of parts.slice(0, 4)) tags.push(t);
  }
  if (p.no) tags.push(`第${p.no}問`);
  return Array.from(new Set(tags)).slice(0, 6);
}

function applyAvgClass(avgDiv, avg) {
  avgDiv.classList.remove("low", "mid", "high");
  if (!Number.isFinite(avg) || avg <= 0) return;
  if (avg < 4) avgDiv.classList.add("low");
  else if (avg < 7) avgDiv.classList.add("mid");
  else avgDiv.classList.add("high");
}

/* =======================================================
 * 11) card
 * ======================================================= */
function buildCard(p, alreadyRated) {
  const div = document.createElement("div");
  div.className = "post";

  const tagsHtml = buildTags(p)
    .map((t) => `<span class="tag">${escapeHTML(t)}</span>`)
    .join("");

  div.innerHTML = `
    <div class="meta">${escapeHTML(p.date)}｜${escapeHTML(p.source)}</div>
    <div class="tags">${tagsHtml}</div>

    <div class="content">
      <div class="tex"></div>
    </div>

    ${p.explain ? `<div class="explain">解説：${escapeHTML(p.explain)}</div>` : ""}

    ${
      p.answer
        ? `<div class="answer">
            <a href="${p.answer}" target="_blank" rel="noopener">▶ 模範解答を見る</a>
          </div>`
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
      ${[1,2,3,4,5,6,7,8,9,10]
        .map((n) => `<button data-score="${n}" ${alreadyRated ? "disabled" : ""}>${n}</button>`)
        .join("")}
    </div>
  `;
  return div;
}

/* =======================================================
 * 12) sort
 * ======================================================= */
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

/* =======================================================
 * 13) render (infinite scroll)
 * ======================================================= */
async function renderOne(p) {
  const ratedKey = `rated_${p.id}`;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");

  // 本文ロード（失敗しても落とさない）
  if (!p.body) {
    try {
      const raw = await fetchTextWithEncoding(p.tex, p.encoding || "auto");
      p.body = normalizeLatexForMathJax(raw);
    } catch (e) {
      console.warn("本文ロード失敗:", p.tex, e);
      p.body = "（本文の読み込みに失敗しました）";
    }
  }

  // QNUMだけHTML許可
  let s = p.body ?? "";
  s = s.replace(/\[\[QNUM:(\d+)\]\]/g, "%%QNUM:$1%%");
  s = escapeHTML(s);
  s = s.replace(/%%QNUM:(\d+)%%/g, '<span class="qnum">$1</span>');

  // MathJax区切り（念のため）
  s = s
    .replace(/\\\(/g, "\\(").replace(/\\\)/g, "\\)")
    .replace(/\\\[/g, "\\[").replace(/\\\]/g, "\\]")
    .replace(/\$/g, "$");

  texEl.innerHTML = s;

  // avg色
  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  // rating buttons
  card.querySelectorAll("button[data-score]").forEach((btn) => {
    btn.onclick = async () => {
      if (localStorage.getItem(ratedKey)) return;

      const score = Number(btn.dataset.score);
      try {
        await addDoc(collection(db, "ratings"), {
          postId: p.id,
          score,
          createdAt: new Date(),
        });
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

  timeline.appendChild(card);

  // 追加分だけ typeset
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
    async (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        await renderNextPage();
      }
    },
    { rootMargin: "600px" }
  );

  observer.observe(sentinel);
  renderNextPage(); // 最初の1ページだけ即表示
}

/* =======================================================
 * 14) search（メタ + 本文、並列ロード、入力更新で中断）
 * ======================================================= */
async function runSearch(enriched, query) {
  const mySeq = ++searchSeq;
  const q = normalizeQuery(query);

  if (!q) {
    resetList(sortPosts(enriched));
    return;
  }

  // メタ検索は即
  const metaMatched = enriched.filter((p) => {
    const meta = normalizeQuery(`${p.date}_${p.no} ${p.source}`);
    return meta.includes(q);
  });

  // 本文検索は並列ロード
  const bodyMatched = [];
  const CONCURRENCY = 6;
  let i = 0;

  const worker = async () => {
    while (i < enriched.length) {
      const p = enriched[i++];

      // 入力更新で中断
      if (mySeq !== searchSeq) return;

      if (!p.body) {
        try {
          const raw = await fetchTextWithEncoding(p.tex, p.encoding || "auto");
          p.body = normalizeLatexForMathJax(raw);
        } catch (e) {
          console.warn("本文ロード失敗:", p.tex, e);
          p.body = "";
        }
      }

      if (normalizeQuery(p.body).includes(q)) bodyMatched.push(p);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 入力更新で反映しない
  if (mySeq !== searchSeq) return;

  // マージ
  const merged = [];
  const seen = new Set();
  for (const p of [...metaMatched, ...bodyMatched]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }

  resetList(sortPosts(merged));
}

/* =======================================================
 * 15) main
 * ======================================================= */
async function main() {
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(`❌ posts_index.json の取得に失敗しました。<div class="muted">${escapeHTML(String(e.message || e))}</div>`);
    return;
  }

  if (posts.length === 0) {
    showNote(
      "⚠️ posts/ に対象ファイルが見つかりません。<div class='muted'>posts_index.json の内容とファイル配置を確認してください。</div>"
    );
    return;
  }

  const ratingMap = await loadRatings();

  const enriched = posts.map((p) => {
    const scores = ratingMap[p.id] ?? [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { ...p, avg, count: scores.length };
  });

  // 初期表示
  resetList(sortPosts(enriched));

  // 並び替え
  sortToggle.onclick = () => {
    sortMode = sortMode === "year" ? "difficulty" : "year";
    sortToggle.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
    resetList(sortPosts(currentList));
  };

  // 検索（デバウンス付き、イベントはこれ1個だけ）
  searchInput.addEventListener("input", () => {
    const q = searchInput.value;

    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      runSearch(enriched, q);
    }, 150);
  });

  // header高さ再同期（フォントロード等のズレ対策）
  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main();
