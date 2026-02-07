// js/search.js
import { normalizeQuery } from "./latex.js";
import { ensureBodyLoaded } from "./posts.js";

export function createSearchRunner({ enriched, sortPosts, resetList, getSearchSeq }) {
  const CONCURRENCY = 6;

  // 表示名（render.jsと同じ）
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

  // ★ LaTeX検索用の正規化（n^2 が n^{2} に負けないように）
  function normalizeLatexForSearch(s) {
    let t = normalizeQuery(s);

    // 肩付き・下付きの { } を外す： ^{2} -> ^2, _{k} -> _k
    t = t.replace(/\^\{([^}]+)\}/g, "^$1").replace(/_\{([^}]+)\}/g, "_$1");

    // {a} {12} みたいな単発の波括弧も外す（邪魔になりやすい）
    t = t.replace(/\{([a-z0-9]+)\}/g, "$1");

    // 空白は全部消す（n ^ { 2 } も拾う）
    t = t.replace(/\s+/g, "");

    return t;
  }

  function parseTerms(inputValue) {
    const raw = String(inputValue || "");
    return raw
      .split(/[,\u3001\uFF0C]/) // , 、 ，
      .map((s) => normalizeLatexForSearch(s))
      .filter(Boolean);
  }

  function extractYear(dateStr) {
    const s = String(dateStr || "");
    const m = s.match(/(19\d{2}|20\d{2})/);
    return m ? m[1] : "";
  }

  function metaText(p) {
    const year = extractYear(p.date);
    const uniJa = displayUniversityName(p.source);
    const metaRaw = `${p.date || ""} ${year} ${p.no || ""} ${p.source || ""} ${uniJa} ${p.id || ""}`;
    return normalizeLatexForSearch(metaRaw);
  }

  return async function runSearch(inputValue, mySeq) {
    const terms = parseTerms(inputValue);

    if (terms.length === 0) {
      resetList(sortPosts(enriched));
      return;
    }

    // メタだけでAND成立するもの（即表示）
    const quickMatched = enriched.filter((p) => {
      const meta = metaText(p);
      return terms.every((t) => meta.includes(t));
    });

    // 本文込み（メタ+本文に分散しても拾う）
    const fullMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];

        if (mySeq !== getSearchSeq()) return;

        try {
          await ensureBodyLoaded(p);
        } catch (e) {
          console.warn("本文ロード失敗:", p?.tex, e);
        }

        if (mySeq !== getSearchSeq()) return;

        const meta = metaText(p);
        const body = normalizeLatexForSearch(p.body || "");
        const combined = meta + body; // 空白消してるので連結はこれでOK

        if (terms.every((t) => combined.includes(t))) {
          fullMatched.push(p);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (mySeq !== getSearchSeq()) return;

    // マージ（重複除去）
    const merged = [];
    const seen = new Set();
    for (const p of [...quickMatched, ...fullMatched]) {
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    resetList(sortPosts(merged));
  };
}
