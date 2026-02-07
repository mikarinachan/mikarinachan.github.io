export function createSearchRunner({ normalizeQuery, ensureBodyLoaded, sortPosts, resetList }) {
  let searchSeq = 0;

  // id -> normalized body cache
  const bodyCache = new Map();
  // id -> normalized meta cache（最初に作る）
  const metaCache = new Map();

  const CONCURRENCY = 6;

  async function ensureBodyNorm(p) {
    if (bodyCache.has(p.id)) return bodyCache.get(p.id);

    await ensureBodyLoaded(p); // ここで p.body が埋まる前提
    const norm = normalizeQuery(p.body || "");
    bodyCache.set(p.id, norm);
    return norm;
  }

  return async function runSearch(enriched, inputValue) {
    const mySeq = ++searchSeq;
    const q = normalizeQuery(inputValue);

    if (!q) {
      resetList(sortPosts(enriched));
      return;
    }

    // meta cache 初回構築
    if (metaCache.size === 0) {
      for (const p of enriched) {
        metaCache.set(p.id, normalizeQuery(`${p.date}_${p.no} ${p.source}`));
      }
    }

    // まずメタ検索（速い）
    const metaMatched = [];
    for (const p of enriched) {
      if (metaCache.get(p.id)?.includes(q)) metaMatched.push(p);
    }

    // クエリが短いときは本文まで行かない（体感が爆速になる）
    if (q.length <= 1) {
      resetList(sortPosts(metaMatched));
      return;
    }

    // 本文検索（並列・中断可能）
    const bodyMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];

        if (mySeq !== searchSeq) return; // 入力更新で中断

        try {
          const normBody = await ensureBodyNorm(p);
          if (normBody.includes(q)) bodyMatched.push(p);
        } catch {
          // 本文取得失敗はスキップ
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (mySeq !== searchSeq) return;

    // merge
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
