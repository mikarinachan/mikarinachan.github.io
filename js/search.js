// js/search.js
import { normalizeQuery } from "./latex.js";
import { ensureBodyLoaded } from "./posts.js";

/**
 * 検索仕様（最終版）
 * - カンマ区切り AND 検索（, 、 ，）
 * - メタ + 本文をまとめて AND 判定
 * - 日本語は消さない（normalizeQueryを通さない）
 * - 英数・LaTeXは正規化（n^2 ⇔ n^{2}）
 * - 大学名：tokyo / 東京大学 両対応
 */
export function createSearchRunner({ enriched, sortPosts, resetList, getSearchSeq }) {
  const CONCURRENCY = 6;

  /* =========================
     大学名対応
  ========================= */
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

  /* =========================
     検索用正規化
  ========================= */
  function normalizeLatexForSearch(s) {
    if (!s) return "";

    // 日本語を含むか判定
    const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(s);

    // 日本語を含む場合は normalizeQuery を通さない
    let t = hasJapanese ? String(s) : normalizeQuery(String(s));

    // LaTeX表記ゆれ吸収
    t = t
      // ^{2} -> ^2, _{k} -> _k
      .replace(/\^\{([^}]+)\}/g, "^$1")
      .replace(/_\{([^}]+)\}/g, "_$1")
      // {n}, {12} など単独波括弧を除去
      .replace(/\{([a-z0-9]+)\}/gi, "$1")
      // 空白を除去（n ^ { 2 } も拾う）
      .replace(/\s+/g, "");

    return t;
  }

  /* =========================
     入力を AND 条件に分解
  ========================= */
  function parseTerms(inputValue) {
    return String(inputValue || "")
      .split(/[,\u3001\uFF0C]/) // , 、 ，
      .map((s) => normalizeLatexForSearch(s))
      .filter(Boolean);
  }

  function extractYear(dateStr) {
    const m = String(dateStr || "").match(/(19\d{2}|20\d{2})/);
    return m ? m[1] : "";
  }

  /* =========================
     メタ情報文字列
  ========================= */
  function metaText(p) {
    const year = extractYear(p.date);
    const uniJa = displayUniversityName(p.source);

    const metaRaw =
      `${p.date || ""} ${year} ${p.no || ""} ` +
      `${p.source || ""} ${uniJa} ${p.id || ""}`;

    return normalizeLatexForSearch(metaRaw);
  }

  /* =========================
     検索実行
  ========================= */
  return async function runSearch(inputValue, mySeq) {
    const terms = parseTerms(inputValue);

    // 空入力 → 全件
    if (terms.length === 0) {
      resetList(sortPosts(enriched));
      return;
    }

    /* ---------- メタだけで AND 成立するもの ---------- */
    const quickMatched = enriched.filter((p) => {
      const meta = metaText(p);
      return terms.every((t) => meta.includes(t));
    });

    /* ---------- 本文込みで AND 判定 ---------- */
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

        const combined =
          metaText(p) + normalizeLatexForSearch(p.body || "");

        if (terms.every((t) => combined.includes(t))) {
          fullMatched.push(p);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (mySeq !== getSearchSeq()) return;

    /* ---------- マージ（重複除去） ---------- */
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
