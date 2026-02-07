
import { normalizeQuery } from "./latex.js";
import { ensureBodyLoaded } from "./posts.js";

export function createSearchRunner({ concurrency = 6 } = {}) {
  let seq = 0;

  return async function runSearch(enriched, query, onDone) {
    const mySeq = ++seq;
    const q = normalizeQuery(query);

    if (!q) {
      onDone(enriched);
      return;
    }

    const metaMatched = enriched.filter((p) => {
      const meta = normalizeQuery(`${p.date}_${p.no} ${p.source}`);
      return meta.includes(q);
    });

    const bodyMatched = [];
    let i = 0;

    const worker = async () => {
      while (i < enriched.length) {
        const p = enriched[i++];
        if (mySeq !== seq) return;

        if (!p.body) {
          try { await ensureBodyLoaded(p); }
          catch { p.body = ""; }
        }
        if (normalizeQuery(p.body).includes(q)) bodyMatched.push(p);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    if (mySeq !== seq) return;

    const merged = [];
    const seen = new Set();
    for (const p of [...metaMatched, ...bodyMatched]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }

    onDone(merged);
  };
}
