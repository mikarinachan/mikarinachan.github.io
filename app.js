// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";




async function fetchTextWithEncoding(url, encoding = "auto") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);

  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);

  const enc = String(encoding || "auto").toLowerCase();

  // Shift_JIS 変換（encoding-japanese）
  const decodeSJIS = () => {
    if (!window.Encoding) {
      throw new Error("encoding-japanese が読み込まれていません（index.htmlを確認）");
    }
    return window.Encoding.convert(bytes, {
      to: "UNICODE",
      from: "CP932",
      type: "string",
    });
  };

  // UTF-8 変換（厳格：壊れてたら例外にする）
  const decodeUTF8Strict = () => {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  };

  // 1) 明示指定があるならそれを優先
  if (enc === "utf-8" || enc === "utf8") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (enc === "shift_jis" || enc === "shift-jis" || enc === "sjis") {
    return decodeSJIS();
  }

  // 2) auto: UTF-8 をまず「厳格」に試す → 失敗したら SJIS
  if (enc === "auto") {
    try {
      const s = decodeUTF8Strict();
      return s; // UTF-8として正しい
    } catch {
      // UTF-8として壊れている → SJISで読む
      return decodeSJIS();
    }
  }

  // 3) その他（最後に TextDecoder を試す / ダメならUTF-8）
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}














/* ---------- Firebase ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyCfyTtuLXAmibDu2ebKSTUI-_ZKFrv8Syo",
  authDomain: "math-memo-870c0.firebaseapp.com",
  projectId: "math-memo-870c0",
  storageBucket: "math-memo-870c0.firebasestorage.app",
  messagingSenderId: "396039327636",
  appId: "1:396039327636:web:028aa61574d06623240981"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- DOM ---------- */
const timeline = document.getElementById("timeline");
let sortMode = "year"; // 並び替えモード（年度順/難易度順）

/* ---------- A: header高さをCSS変数に同期 ---------- */
function syncHeaderHeight() {
  const h = document.querySelector("header")?.offsetHeight || 72;
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}
window.addEventListener("resize", syncHeaderHeight);

/* ---------- Toolbar (search / clear / sort) ---------- */
const toolbar = document.createElement("div");
toolbar.className = "toolbar"; // ★CSS側の固定スタイル用

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

// toolbar組み立て
toolbarInner.appendChild(searchInput);
toolbarInner.appendChild(clearBtn);
toolbarInner.appendChild(sortToggle);
toolbar.appendChild(toolbarInner);

// timeline は <main> の中にある前提
timeline.before(toolbar);

// 初回同期（DOMできてから）
syncHeaderHeight();

/* ---------- UI note ---------- */
function showNote(html) {
  const div = document.createElement("div");
  div.className = "system-note";
  div.innerHTML = html;
  timeline.prepend(div);
}

/* ---------- util: encoding付き fetch ---------- */
/* ---------- util: encoding付き fetch（auto対応） ---------- */




/* ---------- util: pathから文字コードを推測 ---------- */
function guessEncoding(path) {
  const p = String(path || "");

  // 旧問は Shift_JIS が多い（必要なら増減OK）
  const sjisPrefixes = [
    "posts/01_tokyo/",
    "posts/02_kyoto/",
    "posts/03_hokudai/",
    "posts/04_tohoku/",
    "posts/05_nagoya/",
    "posts/06_osaka/",
    "posts/07_kyushu/",
    "posts/08_titech/"
  ];

  if (sjisPrefixes.some((prefix) => p.startsWith(prefix))) return "shift_jis";
  return "utf-8";
}


/* ---------- util: HTML escape ---------- */
function escapeHTML(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- util: LaTeX → 表示用に正規化（MathJax非対応を剥がす） ---------- */
function normalizeLatexForMathJax(tex) {
  return tex
    // MathJaxで死にやすい/警告になる命令をまとめて除去
    .replace(/\\hspace\*?\{[^}]*\}/g, "")
    .replace(/\\vspace\*?\{[^}]*\}/g, "")
    .replace(/\\(smallskip|medskip|bigskip)\b/g, "")
    .replace(/\\(noindent|par|indent)\b/g, "\n")
    .replace(/\\(newpage|clearpage|pagebreak|linebreak)\b(\[[^\]]*\])?/g, "\n")
    .replace(/\\(qquad|quad)\b/g, " ")
    .replace(/\\,/g, " ")

    // レイアウト命令
    .replace(/\\setlength\{[^}]+\}\{[^}]+\}/g, "")
    .replace(/\\addtolength\{[^}]+\}\{[^}]+\}/g, "")
    .replace(
      /\\(textwidth|textheight|oddsidemargin|evensidemargin|topmargin|headheight|headsep|footskip)\s*=?\s*[^\\\n]*/g,
      ""
    )

    // 図・表・外部ファイル系
    .replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\input\{[^}]*\}/g, "")
    .replace(/\\include\{[^}]*\}/g, "")
    .replace(/\\bibliography\{[^}]*\}/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}/g, "")

    // tikz/picture系
    .replace(/\\begin\{(tikzpicture|picture|pspicture|circuitikz)\}[\s\S]*?\\end\{\1\}/g, "")

    // raisebox/phantom系
    .replace(/\\raisebox\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\(phantom|hphantom|vphantom)\{[^}]*\}/g, "")

    // color系
    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\color\{[^}]*\}/g, "")

    // label/ref/cite
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "")
    .replace(/\\cite\{[^}]*\}/g, "")

    // document前後
    .replace(/^[\s\S]*?\\begin\{document\}/, "")
    .replace(/\\end\{document\}[\s\S]*$/, "")

    // 前置き命令
    .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\pagestyle\{[^}]+\}/g, "")

    // 文字サイズ命令
    .replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, "")

    // 文章レイアウト環境は剥がす
    .replace(/\\begin\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\end\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\begin\{(?:description|itemize|enumerate)\}/g, "\n")
    .replace(/\\end\{(?:description|itemize|enumerate)\}/g, "\n")

    // item の整形（(i)(ii)(iii)も(1)も対応）
    .replace(/\\item\s*\[\s*\(([^)]+)\)\s*\]\s*/g, "\n（$1） ")
    .replace(/\\item\s*\[\s*([^\]]+)\s*\]\s*/g, "\n$1： ")
    .replace(/\\item\b\s*/g, "\n・ ")

    // {4} みたいな行頭番号をQNUMタグへ
    .replace(/^\s*\{(\d+)\}\s*$/m, "[[QNUM:$1]]")
    .replace(/\{\s*\\huge\s+(\d+)\s*\}/g, "[[QNUM:$1]]")

    // 整形
    .replace(/\u3000+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------- posts index ---------- */
async function loadPostIndex() {
  const r = await fetch("posts_index.json", { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}: posts_index.json`);
  const posts = await r.json();

  const cleaned = posts
    .filter((p) => p && p.id && p.tex)
    .map((p) => ({
      id: String(p.id),
      tex: String(p.tex),
      date: String(p.date ?? ""),
      no: Number(p.no ?? 0),
      source: String(p.source ?? "入試問題"),
      encoding: String(p.encoding ?? "auto"),

      explain: String(p.explain ?? ""),
      answer: String(p.answer ?? ""),
      body: ""
    }));

  cleaned.sort((a, b) => b.date.localeCompare(a.date) || a.no - b.no);
  return cleaned;
}

/* ---------- ratings ---------- */
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

/* ---------- C: tags生成 ---------- */
function buildTags(p) {
  const tags = [];

  if (p.date) tags.push(p.date);

  if (p.source) {
    const parts = String(p.source).replace(/[｜|・]/g, " ").split(/\s+/).filter(Boolean);
    for (const t of parts.slice(0, 4)) tags.push(t);
  }

  if (p.no) tags.push(`第${p.no}問`);

  return Array.from(new Set(tags)).slice(0, 6);
}

/* ---------- B: avg色分け ---------- */
function applyAvgClass(avgDiv, avg) {
  avgDiv.classList.remove("low", "mid", "high");
  if (!Number.isFinite(avg) || avg <= 0) return;

  if (avg < 4) avgDiv.classList.add("low");
  else if (avg < 7) avgDiv.classList.add("mid");
  else avgDiv.classList.add("high");
}

/* ---------- card ---------- */
function buildCard(p, alreadyRated) {
  const div = document.createElement("div");
  div.className = "post";

  const tagsHtml = buildTags(p).map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join("");

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
        <b>${p.count ? p.avg.toFixed(2) : "未評価"}</b>
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

/* ---------- sort ---------- */
function sortPosts(list) {
  const arr = list.slice();

  if (sortMode === "difficulty") {
    arr.sort((a, b) => b.avg - a.avg);
  } else {
    // 年度降順 → 問題番号昇順
    arr.sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) return d;
      return a.no - b.no;
    });
  }
  return arr;
}

/* ---------- infinite scroll ---------- */
const PAGE_SIZE = 5;
let currentList = [];
let rendered = 0;
let isLoading = false;
let observer = null;

const sentinel = document.createElement("div");
sentinel.style.height = "1px";

async function renderOne(p) {
  const ratedKey = `rated_${p.id}`;
  const alreadyRated = localStorage.getItem(ratedKey);

  const card = buildCard(p, alreadyRated);
  const texEl = card.querySelector(".tex");

  if (!p.body) {
    const raw = await fetchTextWithEncoding(p.tex, p.encoding || "auto")

    p.body = normalizeLatexForMathJax(raw);
  }

  // 1) QNUM だけ先に避難（許可HTML）
  let s = p.body ?? "";
  s = s.replace(/\[\[QNUM:(\d+)\]\]/g, "%%QNUM:$1%%");

  // 2) 全体をHTMLエスケープ
  s = escapeHTML(s);

  // 3) QNUMだけHTMLとして復元
  s = s.replace(/%%QNUM:(\d+)%%/g, '<span class="qnum">$1</span>');

  // 4) MathJaxのための区切り（念のため）
  s = s
    .replace(/\\\(/g, "\\(").replace(/\\\)/g, "\\)")
    .replace(/\\\[/g, "\\[").replace(/\\\]/g, "\\]")
    .replace(/\$/g, "$");

  texEl.innerHTML = s;

  // avg色
  const avgDiv = card.querySelector("[data-avg]");
  applyAvgClass(avgDiv, p.avg);

  card.querySelectorAll("button").forEach((btn) => {
    btn.onclick = async () => {
      if (localStorage.getItem(ratedKey)) return;

      const score = Number(btn.dataset.score);
      try {
        await addDoc(collection(db, "ratings"), {
          postId: p.id,
          score,
          createdAt: new Date()
        });
      } catch (e) {
        console.error(e);
        alert("評価の送信に失敗しました（権限/通信）。Console を確認してください。");
        return;
      }

      const newAvg = (p.avg * p.count + score) / (p.count + 1);
      p.avg = newAvg;
      p.count += 1;

      // badge形式で更新
      avgDiv.innerHTML = `
        <span>平均難易度：</span>
        <span class="avg-badge"><b>${newAvg.toFixed(2)}</b>（${p.count}人）</span>
      `;
      applyAvgClass(avgDiv, newAvg);

      localStorage.setItem(ratedKey, String(score));
      card.querySelectorAll("button").forEach((b) => (b.disabled = true));
      btn.classList.add("selected");
    };
  });

  timeline.appendChild(card);

  // 追加した要素だけ MathJax を当てる
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
  renderNextPage(); // 最初の1ページだけ即表示
}

/* ---------- search ---------- */
function normalizeQuery(q) {
  return (q || "").trim().toLowerCase();
}

/* ---------- main ---------- */
async function main() {
  let posts = [];
  try {
    posts = await loadPostIndex();
  } catch (e) {
    console.error(e);
    showNote(`❌ posts/ の一覧取得に失敗しました。<div class="muted">${String(e.message || e)}</div>`);
    return;
  }

  if (posts.length === 0) {
    showNote(
      "⚠️ posts/ に対象ファイルが見つかりません。<div class='muted'>ファイル名は <b>2025_6.tex</b> のように <b>YYYY_N.tex</b> 形式にしてください。</div>"
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

  // 並び替えボタン
  sortToggle.onclick = () => {
    sortMode = sortMode === "year" ? "difficulty" : "year";
    sortToggle.textContent = sortMode === "year" ? "並び順：年度順" : "並び順：難易度順";
    resetList(sortPosts(currentList));
  };

  // 検索（本文検索のため、未ロードのbodyも必要なら読む）
  searchInput.addEventListener("input", async () => {
    const q = normalizeQuery(searchInput.value);

    if (!q) {
      resetList(sortPosts(enriched));
      return;
    }

    const metaMatched = enriched.filter((p) => {
      const meta = `${p.date}_${p.no} ${p.source}`.toLowerCase();
      return meta.includes(q);
    });

    const bodyMatched = [];
    for (const p of enriched) {
      if (!p.body) {
        try {
          const raw = await fetchTextWithEncoding(p.tex, p.encoding || "auto")

          p.body = normalizeLatexForMathJax(raw);
        } catch {}
      }
      if ((p.body || "").toLowerCase().includes(q)) bodyMatched.push(p);
    }

    const merged = [];
    const seen = new Set();
    for (const p of [...metaMatched, ...bodyMatched]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    resetList(sortPosts(merged));
  });

  // 追加：header高さを再同期（フォントロード等でズレる対策）
  requestAnimationFrame(syncHeaderHeight);
  setTimeout(syncHeaderHeight, 300);
  setTimeout(syncHeaderHeight, 1200);
}

main();
