// js/search.js
import { normalizeQuery } from "./latex.js";
import { ensureBodyLoaded } from "./posts.js";

/**
 * ✅ 仕様
 * - 入力を「,」「、」「，」で分割 → AND検索
 * - AND判定は「メタ + 本文」を結合した全体で行う
 *   → 単語がメタと本文に分散してもヒットする
 * - メタだけで確定ANDできるものは即表示
 * - 本文は未ロードでもロードして判定（失敗しても止めない）
 */
export function createSearchRunner({ enriched, sortPosts, resetList, getSearchSeq }) {
  const CONCURRENCY = 6;

  function parseTerms(inputValue) {
    const raw = String(inputValue || "");
    return raw
      .split(/[,\u3001\uFF0C]/) // , 、 ，(fullwidth)
      .map((s) => normalizeQuery(s))
      .filter(Boolean);
  }

  function metaText(p) {
    // メタに入れたいものがあればここに足す
    return normalizeQuery(`${p.date || ""}_${p.no || ""} ${p.source || ""} ${p.id || ""}`);
  }

  return async function runSearch(inputValue, mySeq) {
    const terms = parseTerms(inputValue);

    // 空なら全件
    if (terms.length === 0) {
      resetList(sortPosts(enriched));
      return;
    }

    // まずメタだけでAND成立するものは即返す（速い）
    const quickMatched = enriched.filter((p) => {
      const meta = metaText(p);
      return terms.every((t) => meta.includes(t));
    });

    // ただし「メタと本文に分散」も拾いたいので、全文チェックも走らせる
    const fullMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];

        if (mySeq !== getSearchSeq()) return;

        // 本文ロード（失敗しても止めない）
        try {
          await ensureBodyLoaded(p);
        } catch (e) {
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

    // quickMatched + fullMatched をマージ（重複除去）
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
