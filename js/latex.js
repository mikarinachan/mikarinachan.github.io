// js/latex.js

/* ---------- util: HTML escape ---------- */
export function escapeHTML(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- util: 検索用 正規化 ---------- */
export function normalizeQuery(q) {
  return (q ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKC");
}

/* ---------- util: LaTeX → 表示用に正規化（不要命令を剥がす） ---------- */
export function normalizeLatexForMathJax(tex) {
  return (tex ?? "")
    // ★ これが表示されちゃう件の本丸：setlength 系を除去
    .replace(/\\setlength\s*\{\s*\\baselineskip\s*\}\s*\{[^}]*\}\s*/g, "")
    .replace(/\\setlength\s*\{[^}]+\}\s*\{[^}]+\}\s*/g, "")
    .replace(/\\addtolength\s*\{[^}]+\}\s*\{[^}]+\}\s*/g, "")

    // MathJaxで死にやすい/警告になる命令をまとめて除去
    .replace(/\\hspace\*?\{[^}]*\}/g, "")
    .replace(/\\vspace\*?\{[^}]*\}/g, "")
    .replace(/\\(smallskip|medskip|bigskip)\b/g, "")
    .replace(/\\(noindent|par|indent)\b/g, "\n")
    .replace(/\\(newpage|clearpage|pagebreak|linebreak)\b(\[[^\]]*\])?/g, "\n")
    .replace(/\\(qquad|quad)\b/g, " ")
    .replace(/\\,/g, " ")

    // 図・表・外部ファイル系
    .replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\input\{[^}]*\}/g, "")
    .replace(/\\include\{[^}]*\}/g, "")
    .replace(/\\bibliography\{[^}]*\}/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}/g, "")

    // tikz/picture系
    .replace(/\\begin\{(tikzpicture|picture|pspicture|circuitikz)\}[\s\S]*?\\end\{\1\}/g, "")

    // raisebox/phantom系
    .replace(/\\raisebox\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\(phantom|hphantom|vphantom)\{[^}]*\}/g, "")

    // color系
    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\color\{[^}]*\}/g, "")

    // label/ref/cite
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "")
    .replace(/\\cite\{[^}]*\}/g, "")

    // document前後
    .replace(/^[\s\S]*?\\begin\{document\}/, "")
    .replace(/\\end\{document\}[\s\S]*$/, "")

    // 前置き命令
    .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\pagestyle\{[^}]+\}/g, "")

    // 文字サイズ命令
    .replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, "")

    // 文章レイアウト環境は剥がす
    .replace(/\\begin\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\end\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\begin\{(?:description|itemize|enumerate)\}/g, "\n")
    .replace(/\\end\{(?:description|itemize|enumerate)\}/g, "\n")

    // item の整形（(i)(ii)(iii)も(1)も対応）
    .replace(/\\item\s*\[\s*\(([^)]+)\)\s*\]\s*/g, "\n（$1） ")
    .replace(/\\item\s*\[\s*([^\]]+)\s*\]\s*/g, "\n$1： ")
    .replace(/\\item\b\s*/g, "\n・ ")

    // {4} みたいな行頭番号をQNUMタグへ
    .replace(/^\s*\{(\d+)\}\s*$/m, "[[QNUM:$1]]")
    .replace(/\{\s*\\huge\s+(\d+)\s*\}/g, "[[QNUM:$1]]")

    // 整形
    .replace(/\u3000+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
