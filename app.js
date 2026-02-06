// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

/* ---------- Toolbar (search / clear / sort) ---------- */
const toolbar = document.createElement("div");
toolbar.style.display = "flex";
toolbar.style.gap = "0.6rem";
toolbar.style.alignItems = "center";
toolbar.style.margin = "0 0 1rem";

const searchInput = document.createElement("input");
searchInput.type = "search";
searchInput.placeholder = "検索（例: 2025 / 6 / 複素数 / Re / 4a+1 など）";
searchInput.style.flex = "1";
searchInput.style.padding = "0.7rem 0.9rem";
searchInput.style.borderRadius = "10px";
searchInput.style.border = "1px solid #ddd";
searchInput.style.fontSize = "1rem";
searchInput.autocomplete = "off";

const clearBtn = document.createElement("button");
clearBtn.textContent = "クリア";
clearBtn.style.padding = "0.7rem 0.9rem";
clearBtn.style.borderRadius = "10px";
clearBtn.style.border = "1px solid #ddd";
clearBtn.style.background = "#fff";
clearBtn.style.cursor = "pointer";

clearBtn.onclick = () => {
  searchInput.value = "";
  searchInput.dispatchEvent(new Event("input"));
};

const sortToggle = document.createElement("button");
sortToggle.textContent = "並び順：年度順";
sortToggle.style.padding = "0.7rem 0.9rem";
sortToggle.style.borderRadius = "10px";
sortToggle.style.border = "1px solid #ddd";
sortToggle.style.background = "#fff";
sortToggle.style.cursor = "pointer";

toolbar.appendChild(searchInput);
toolbar.appendChild(clearBtn);
toolbar.appendChild(sortToggle);

// timeline は <main> の中にある前提
timeline.before(toolbar);

/* ---------- UI note ---------- */
function showNote(html) {
  const div = document.createElement("div");
  div.className = "system-note";
  div.innerHTML = html;
  timeline.prepend(div);
}

/* ---------- util: encoding付き fetch ---------- */
async function fetchTextWithEncoding(url, encoding = "utf-8") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();

  try {
    return new TextDecoder(encoding).decode(buf);
  } catch (e) {
    console.warn(`TextDecoder(${encoding}) 失敗 → utf-8で再試行`, e);
    return new TextDecoder("utf-8").decode(buf);
  }
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
      encoding: String(p.encoding ?? "utf-8"),
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

/* ---------- card ---------- */
function buildCard(p, alreadyRated) {
  const div = document.createElement("div");
  div.className = "post";

  div.innerHTML = `
    <div class="meta">${p.date}｜${p.source}</div>

    <div class="content">
      <div class="tex"></div>
    </div>

    ${p.explain ? `<div class="explain">解説：${p.explain}</div>` : ""}

    ${
      p.answer
        ? `<div class="answer">
            <a href="${p.answer}" target="_blank" rel="noopener">▶ 模範解答を見る</a>
          </div>`
        : ""
    }

    <div class="avg" data-avg>
      平均難易度：<b>${p.count ? p.avg.toFixed(2) : "未評価"}</b>
      ${p.count ? `（${p.count}人）` : ""}
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
    const raw = await fetchTextWithEncoding(p.tex, p.encoding || "utf-8");
    p.body = normalizeLatexForMathJax(raw);
  }

  // 1) QNUM だけ先に避難（許可HTML）
  let s = p.body ?? "";
  s = s.replace(/\[\[QNUM:(\d+)\]\]/g, "%%QNUM:$1%%");

  // 2) 全体をHTMLエスケープ
  s = escapeHTML(s);

  // 3) QNUMだけHTMLとして復元
  s = s.replace(/%%QNUM:(\d+)%%/g, '<span class="qnum">$1</span>');

  // 4) MathJaxのために区切り記号は生（escapeHTMLで壊れてない想定）
  //    ※ここは実質そのままでもOK。念のため残してる。
  s = s
    .replace(/\\\(/g, "\\(").replace(/\\\)/g, "\\)")
    .replace(/\\\[/g, "\\[").replace(/\\\]/g, "\\]")
    .replace(/\$/g, "$");

  texEl.innerHTML = s;

  const avgDiv = card.querySelector("[data-avg]");

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

      avgDiv.innerHTML = `平均難易度：<b>${newAvg.toFixed(2)}</b>（${p.count}人）`;

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
          const raw = await fetchTextWithEncoding(p.tex, p.encoding || "utf-8");
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
}

main();
