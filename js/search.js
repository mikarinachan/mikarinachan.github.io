// js/search.js
console.log("SEARCH CANDIDATE");

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

  // 日本語を消さない正規化（LaTeXゆれ対応）
  function norm(s) {
  if (s == null) return "";
  let t = String(s).normalize("NFKC").toLowerCase();

  // LaTeXゆれ
  t = t
    .replace(/\^\{([^}]+)\}/g, "^$1")
    .replace(/_\{([^}]+)\}/g, "_$1")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\,/g, "")
    .replace(/\\!/g, "")
    .replace(/\\;/g, "")
    .replace(/\\quad/g, "")
    .replace(/\\qquad/g, "");

  // 余計な括弧を落とす（数式検索を強くする）
  t = t.replace(/[{}]/g, "");

  // 等号・括弧・カンマの揺れを吸収（必要ならさらに増やせる）
  // t = t.replace(/[()]/g, "");

  // 空白は全部削除
  t = t.replace(/\s+/g, "");

  // ★ 超重要：暗黙の掛け算を吸収
  // 例: "a x" / "ax" / "a*x" を同一視したい → "*" を消す
  t = t.replace(/\*/g, "");

  // ★ "y=" の有無を吸収（式だけ検索しやすく）
  t = t.replace(/^y=/, "");

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

    // tokyo / 東京大学 どっちでも当たるように両方入れる
    const raw =
      `${p.date || ""} ${year} ${p.no || ""} ${p.id || ""} ` +
      `${uniKey} ${uniJa}`;

    return norm(raw);
  }

  // term が「メタで判定できるもの」か判定
  function isMetaTerm(t) {
    if (!t) return false;
    if (/^\d{4}$/.test(t)) return true;        // 年
    if (t.includes("大学")) return true;       // 日本語大学名
    if (UNIVERSITY_NAME_MAP[t]) return true;   // tokyo/titech/...
    return false;
  }

  return async function runSearch(inputValue, mySeq) {
    const terms = parseTerms(inputValue);
    console.log("SEARCH terms:", terms);

    if (terms.length === 0) {
      resetList(sortPosts(enriched));
      return;
    }

    // ① メタ条件と本文条件に分離
    const metaTerms = terms.filter(isMetaTerm);
    const bodyTerms = terms.filter((t) => !isMetaTerm(t));

    // ② メタ条件で候補を絞る（ここが超重要）
    const candidates = metaTerms.length
      ? enriched.filter((p) => {
          const meta = metaText(p);
          return metaTerms.every((t) => meta.includes(t));
        })
      : enriched.slice();

    // メタだけの検索なら即反映（速い）
    if (bodyTerms.length === 0) {
      resetList(sortPosts(candidates));
      return;
    }

    // ③ 本文条件がある場合：
    //    ここで 0件に即リセットしない（真っ白回避）
    //    候補が小さいなら一瞬で終わるので、最終結果だけ反映する
    const matched = [];
    let i = 0;

    const worker = async () => {
      while (i < candidates.length) {
        const p = candidates[i++];

        if (mySeq !== getSearchSeq()) return;

        try {
          await ensureBodyLoaded(p);
        } catch {
          // 失敗はスキップ
        }

        if (mySeq !== getSearchSeq()) return;

        const combined = metaText(p) + norm(p.body || "");
        if (bodyTerms.every((t) => combined.includes(t))) {
          matched.push(p);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (mySeq !== getSearchSeq()) return;

    resetList(sortPosts(matched));
  };
}
