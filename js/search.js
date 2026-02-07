// js/search.js
console.log("SEARCH FAST");

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

  // ✅ 日本語を消さない正規化（軽量）
  function norm(s) {
    if (s == null) return "";
    let t = String(s).normalize("NFKC").toLowerCase();
    t = t
      .replace(/\^\{([^}]+)\}/g, "^$1")
      .replace(/_\{([^}]+)\}/g, "_$1")
      .replace(/\{([a-z0-9]+)\}/gi, "$1")
      .replace(/\s+/g, "");
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

  // ✅ 「本文検索が必要か？」を判定（年・大学だけなら本文不要で爆速）
  function needsBodySearch(terms) {
    return terms.some((t) => {
      if (/^\d{4}$/.test(t)) return false;            // 年
      if (t.includes("大学")) return false;           // 大学名（日本語）
      if (UNIVERSITY_NAME_MAP[t]) return false;       // tokyo/titech 等
      // ↑以外は本文にある可能性が高い（n^2, integral, 文字列など）
      return true;
    });
  }

  return async function runSearch(inputValue, mySeq) {
    const terms = parseTerms(inputValue);
    console.log("SEARCH terms:", terms);

    // 空なら全件
    if (terms.length === 0) {
      resetList(sortPosts(enriched));
      console.log("SEARCH reset(all)");
      return;
    }

    // ① メタ一致は即反映（ここが重要）
    const metaMatched = enriched.filter((p) => {
      const meta = metaText(p);
      return terms.every((t) => meta.includes(t));
    });

    resetList(sortPosts(metaMatched));
    console.log("SEARCH reset(meta):", metaMatched.length);

    // 入力が更新されたらここで終了（古い検索を反映しない）
    if (mySeq !== getSearchSeq()) return;

    // ② 本文検索が不要なら終わり（年/大学だけならこれで十分）
    if (!needsBodySearch(terms)) return;

    // ③ 本文込みで追加ヒットを探す（重いので後回し）
    const bodyMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];

        if (mySeq !== getSearchSeq()) return;

        try {
          await ensureBodyLoaded(p);
        } catch (e) {
          // 読めないものはスキップ
        }

        if (mySeq !== getSearchSeq()) return;

        const combined = metaText(p) + norm(p.body || "");
        if (terms.every((t) => combined.includes(t))) {
          bodyMatched.push(p);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (mySeq !== getSearchSeq()) return;

    // ④ メタ＋本文をマージして再反映
    const merged = [];
    const seen = new Set();
    for (const p of [...metaMatched, ...bodyMatched]) {
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    resetList(sortPosts(merged));
    console.log("SEARCH reset(merged):", merged.length);
  };
}
