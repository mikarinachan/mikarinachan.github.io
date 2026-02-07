// js/search.js
console.log("SEARCH 1820");

import { ensureBodyLoaded } from "./posts.js";

export function createSearchRunner({ enriched, sortPosts, resetList, getSearchSeq }) {
  const CONCURRENCY = 6;

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

  // ✅ 日本語を消さない正規化
  function norm(s) {
    if (s == null) return "";
    let t = String(s).normalize("NFKC").toLowerCase();

    // LaTeXゆれ
    t = t
      .replace(/\^\{([^}]+)\}/g, "^$1")
      .replace(/_\{([^}]+)\}/g, "_$1")
      .replace(/\{([a-z0-9]+)\}/gi, "$1");

    // 空白削除
    t = t.replace(/\s+/g, "");
    return t;
  }

  function parseTerms(inputValue) {
    return String(inputValue || "")
      .split(/[,\u3001\uFF0C]/) // , 、 ，
      .map((x) => norm(x))
      .filter(Boolean);
  }

  function extractYear(dateStr) {
    const m = String(dateStr || "").match(/(19\d{2}|20\d{2})/);
    return m ? m[1] : "";
  }

  function metaText(p) {
    const year = extractYear(p.date);
    const uniKey = String(p.source || "").toLowerCase();
    const uniJa = displayUniversityName(p.source);

    const raw =
      `${p.date || ""} ${year} ${p.no || ""} ${p.id || ""} ` +
      `${uniKey} ${uniJa}`;

    return norm(raw);
  }

  return async function runSearch(inputValue, mySeq) {
    const terms = parseTerms(inputValue);
    console.log("SEARCH terms:", terms);

    if (terms.length === 0) {
      resetList(sortPosts(enriched));
      return;
    }

    const quickMatched = enriched.filter((p) => {
      const meta = metaText(p);
      return terms.every((t) => meta.includes(t));
    });

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

        const combined = metaText(p) + norm(p.body || "");
        if (terms.every((t) => combined.includes(t))) {
          fullMatched.push(p);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (mySeq !== getSearchSeq()) return;

    const merged = [];
    const seen = new Set();
    for (const p of [...quickMatched, ...fullMatched]) {
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    console.log("SEARCH result count:", merged.length);
    resetList(sortPosts(merged));
  };
}
