// js/search.js
import { normalizeQuery } from "./latex.js";
import { ensureBodyLoaded } from "./posts.js";

/**
 * createSearchRunner({
 *   enriched,          // 全投稿配列
 *   sortPosts,         // 並び替え関数
 *   resetList,         // 表示を入れ替える関数
 *   getSearchSeq,      // 現在seq参照（中断用）
 * })
 */
export function createSearchRunner({ enriched, sortPosts, resetList, getSearchSeq }) {
  const CONCURRENCY = 6;

  return async function runSearch(inputValue, mySeq) {
    const q = normalizeQuery(inputValue);

    // 空なら全件
    if (!q) {
      resetList(sortPosts(enriched));
      return;
    }

    // メタ一致（即）
    const metaMatched = enriched.filter((p) => {
      const meta = normalizeQuery(`${p.date}_${p.no} ${p.source}`);
      return meta.includes(q);
    });

    // 本文一致（未ロードでも必ずロードして判定）
    const bodyMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];

        // 入力が更新されたら中断（古い検索結果を反映しない）
        if (mySeq !== getSearchSeq()) return;

        try {
          await ensureBodyLoaded(p); // ★これが重要：未表示でも本文を確実にロード
        } catch (e) {
          // 失敗しても止めない（そのpostは検索対象外になる）
          console.warn("本文ロード失敗:", p?.tex, e);
        }

        if (mySeq !== getSearchSeq()) return;

        const body = normalizeQuery(p.body || "");
        if (body.includes(q)) bodyMatched.push(p);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (mySeq !== getSearchSeq()) return;

    // マージ（重複除去）
    const merged = [];
    const seen = new Set();
    for (const p of [...metaMatched, ...bodyMatched]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    resetList(sortPosts(merged));
  };
}
