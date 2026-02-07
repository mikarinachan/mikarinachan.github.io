
import { normalizeLatexForMathJax } from "./latex.js";

export async function fetchTextWithEncoding(url, encoding = "auto") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);

  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const enc = String(encoding || "auto").toLowerCase();

  const decodeSJIS = () => {
    if (window.Encoding) {
      return window.Encoding.convert(bytes, { to: "UNICODE", from: "CP932", type: "string" });
    }
    try { return new TextDecoder("shift_jis").decode(bytes); }
    catch { return new TextDecoder("utf-8").decode(bytes); }
  };

  const decodeUTF8Strict = () => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

  if (enc === "utf-8" || enc === "utf8") return new TextDecoder("utf-8").decode(bytes);
  if (enc === "shift_jis" || enc === "shift-jis" || enc === "sjis") return decodeSJIS();

  if (enc === "auto") {
    try { return decodeUTF8Strict(); }
    catch { return decodeSJIS(); }
  }

  try { return new TextDecoder(enc).decode(bytes); }
  catch { return new TextDecoder("utf-8").decode(bytes); }
}

export function guessEncoding(path) {
  const p = String(path || "");
  const sjisPrefixes = [
    "posts/01_tokyo/",
    "posts/02_kyoto/",
    "posts/03_hokudai/",
    "posts/04_tohoku/",
    "posts/05_nagoya/",
    "posts/06_osaka/",
    "posts/07_kyushu/",
    "posts/08_titech/"
  ];
  if (sjisPrefixes.some((prefix) => p.startsWith(prefix))) return "shift_jis";
  return "utf-8";
}

export async function loadPostIndex() {
  const r = await fetch("posts_index.json", { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}: posts_index.json`);
  const posts = await r.json();

  const cleaned = (posts || [])
    .filter((p) => p && p.id && p.tex)
    .map((p) => {
      const texPath = String(p.tex);
      const enc = String(p.encoding ?? "auto");
      return {
        id: String(p.id),
        tex: texPath,
        date: String(p.date ?? ""),
        no: Number(p.no ?? 0),
        source: String(p.source ?? "入試問題"),
        encoding: enc === "auto" ? guessEncoding(texPath) : enc,
        explain: String(p.explain ?? ""),
        answer: String(p.answer ?? ""),
        body: ""
      };
    });

  cleaned.sort((a, b) => b.date.localeCompare(a.date) || a.no - b.no);
  return cleaned;
}

export async function ensureBodyLoaded(p) {
  if (p.body) return p.body;
  const raw = await fetchTextWithEncoding(p.tex, p.encoding || "auto");
  p.body = normalizeLatexForMathJax(raw);
  return p.body;
}
