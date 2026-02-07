// js/search.js
import { normalizeQuery } from "./latex.js";
import { ensureBodyLoaded } from "./posts.js";

/**
 * ✅ 仕様
 * - 入力を「,」「、」「，」で分割 → AND検索
 * - AND判定は「メタ + 本文」を結合した全体で行う
 * - メタには「source」「表示名（東京大学）」「年(YYYY)」も混ぜる
 */
export function createSearchRunner({ enriched, sortPosts, resetList, getSearchSeq }) {
  const CONCURRENCY = 6;

  // 表示名（render.js と同じ）
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

  function parseTerms(inputValue) {
    const raw = String(inputValue || "");
    return raw
      .split(/[,\u3001\uFF0C]/) // , 、 ，
      .map((s) => normalizeQuery(s))
      .filter(Boolean);
  }

  function extractYear(dateStr) {
    // "2025", "2025/6", "2025年度", "H25" みたいなのから 4桁西暦を拾う（拾えなければ空）
    const s = String(dateStr || "");
    const m = s.match(/(19\d{2}|20\d{2})/);
    return m ? m[1] : "";
  }

  function metaText(p) {
    const year = extractYear(p.date);
    const uniJa = displayUniversityName(p.source);

    // ★ここが重要：tokyo と 東京大学 の両方、年も入れる
    const metaRaw =
      `${p.date || ""} ${year} ${p.no || ""} ${p.source || ""} ${uniJa} ${p.id || ""}`;

    return normalizeQuery(metaRaw);
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

    // 本文込みでAND成立するもの（メタと本文に分散しても拾う）
    const fullMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];

        if (mySeq !== getSearchSeq()) return;

        try {
          await ensureBodyLoaded(p);
        } catch (e) {
          // 失敗しても止めない
          console.warn("本文ロード失敗:", p?.tex, e);
        }

        if (mySeq !== getSearchSeq()) return;

        const meta = metaText(p);
        const body = normalizeQuery(p.body || "");
        const combined = meta + " " + body;

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
