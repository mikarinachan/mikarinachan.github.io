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
 *
 * ✅ 仕様：
 * - 入力を「,」or「、」で分割して AND 検索
 *   例: "東京大学,2025" => "東京大学" と "2025" を両方含むものだけ
 * - メタ一致は即表示
 * - 本文一致は未ロードでもロードして判定（失敗しても止めない）
 */
export function createSearchRunner({ enriched, sortPosts, resetList, getSearchSeq }) {
  const CONCURRENCY = 6;

  function parseTerms(inputValue) {
    const raw = String(inputValue || "");
    return raw
      .split(/[,\u3001]/) // , or 、(U+3001)
      .map((s) => normalizeQuery(s))
      .filter(Boolean);
  }

  function metaText(p) {
    // メタ検索対象：必要ならここに項目を足してOK
    return normalizeQuery(`${p.date}_${p.no} ${p.source} ${p.id || ""}`);
  }

  return async function runSearch(inputValue, mySeq) {
    const terms = parseTerms(inputValue);

    // 空なら全件
    if (terms.length === 0) {
      resetList(sortPosts(enriched));
      return;
    }

    // メタ一致（即）: AND
    const metaMatched = enriched.filter((p) => {
      const meta = metaText(p);
      return terms.every((t) => meta.includes(t));
    });

    // 本文一致（未ロードでも必ずロードして判定）: AND
    const bodyMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];

        // 入力が更新されたら中断（古い検索結果を反映しない）
        if (mySeq !== getSearchSeq()) return;

        try {
          await ensureBodyLoaded(p);
        } catch (e) {
          // 失敗しても止めない（そのpostは検索対象外になりやすい）
          console.warn("本文ロード失敗:", p?.tex, e);
        }

        if (mySeq !== getSearchSeq()) return;

        const body = normalizeQuery(p.body || "");
        if (terms.every((t) => body.includes(t))) bodyMatched.push(p);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (mySeq !== getSearchSeq()) return;

    // マージ（重複除去）
    const merged = [];
    const seen = new Set();
    for (const p of [...metaMatched, ...bodyMatched]) {
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    resetList(sortPosts(merged));
  };
}
