// js/latex.js

// 文字列正規化（検索用）
export function normalizeQuery(q) {
  return (q || "").trim().toLowerCase().normalize("NFKC");
}

// HTMLエスケープ（※これが二重定義されると redeclaration で死亡）
export function escapeHTML(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * LaTeX → 表示用に正規化（危険/不要な命令を削除）
 * - 問題文冒頭に出てしまう \setlength{\baselineskip}{...} もここで確実に除去
 */
export function normalizeLatexForMathJax(tex) {
  let t = String(tex ?? "");

  // まず document 前後を落とす
  t = t
    .replace(/^[\s\S]*?\\begin\{document\}/, "")
    .replace(/\\end\{document\}[\s\S]*$/, "");

  // \setlength{\baselineskip}{22pt} など（baselineskip専用）
  t = t.replace(/\\setlength\{\s*\\baselineskip\s*\}\{[^}]*\}/g, "");

  // 一般のレイアウト命令（setlength/addtolength）
  t = t
    .replace(/\\setlength\{[^}]+\}\{[^}]+\}/g, "")
    .replace(/\\addtolength\{[^}]+\}\{[^}]+\}/g, "");

  // MathJaxで死にやすい/不要になりがちな命令
  t = t
    .replace(/\\hspace\*?\{[^}]*\}/g, "")
    .replace(/\\vspace\*?\{[^}]*\}/g, "")
    .replace(/\\(smallskip|medskip|bigskip)\b/g, "")
    .replace(/\\(noindent|par|indent)\b/g, "\n")
    .replace(/\\(newpage|clearpage|pagebreak|linebreak)\b(\[[^\]]*\])?/g, "\n")
    .replace(/\\(qquad|quad)\b/g, " ")
    .replace(/\\,/g, " ");

  // 図・表・外部ファイル系
  t = t
    .replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\input\{[^}]*\}/g, "")
    .replace(/\\include\{[^}]*\}/g, "")
    .replace(/\\bibliography\{[^}]*\}/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}/g, "");

  // tikz/picture系 まるごと除去
  t = t.replace(
    /\\begin\{(tikzpicture|picture|pspicture|circuitikz)\}[\s\S]*?\\end\{\1\}/g,
    ""
  );

  // phantom/raisebox
  t = t
    .replace(/\\raisebox\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\(phantom|hphantom|vphantom)\{[^}]*\}/g, "");

  // color系（文字だけ残す）
  t = t
    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\color\{[^}]*\}/g, "");

  // label/ref/cite
  t = t
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "")
    .replace(/\\cite\{[^}]*\}/g, "");

  // 前置き命令
  t = t
    .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\pagestyle\{[^}]+\}/g, "");

  // 文字サイズ命令
  t = t.replace(
    /\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g,
    ""
  );

  // 環境（簡易整形）
  t = t
    .replace(/\\begin\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\end\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\begin\{(?:description|itemize|enumerate)\}/g, "\n")
    .replace(/\\end\{(?:description|itemize|enumerate)\}/g, "\n");

  // item 整形
  t = t
    .replace(/\\item\s*\[\s*\(([^)]+)\)\s*\]\s*/g, "\n（$1） ")
    .replace(/\\item\s*\[\s*([^\]]+)\s*\]\s*/g, "\n$1： ")
    .replace(/\\item\b\s*/g, "\n・ ");

  // {4} みたいな単独行 → QNUMタグへ
  t = t
    .replace(/^\s*\{(\d+)\}\s*$/gm, "[[QNUM:$1]]")
    .replace(/\{\s*\\huge\s+(\d+)\s*\}/g, "[[QNUM:$1]]");

  // 整形
  t = t
    .replace(/\u3000+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return t;
}

/**
 * 正規化済み本文（plain）を「安全なHTML」にする
 * - 全体をescape → QNUMだけHTMLとして復元
 */
export function latexBodyToSafeHTML(normalizedBody) {
  let s = String(normalizedBody ?? "");

  // QNUMだけ避難
  s = s.replace(/\[\[QNUM:(\d+)\]\]/g, "%%QNUM:$1%%");

  // 全体escape
  s = escapeHTML(s);

  // QNUM復元（許可HTML）
  s = s.replace(/%%QNUM:(\d+)%%/g, '<span class="qnum">$1</span>');

  return s;
}
