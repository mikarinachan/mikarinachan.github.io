// js/latex.js

// 検索用：全角半角ゆれ等を揃える
export function normalizeQuery(q) {
  return (q || "")
    .trim()
    .toLowerCase()
    .normalize("NFKC");
}

// HTMLに入れる前のエスケープ（XSS防止）
export function escapeHTML(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// LaTeX → 表示用に掃除（MathJaxで死ぬ/本文先頭に出る命令を除去）
export function normalizeLatexForMathJax(tex) {
  return String(tex ?? "")
    // ★これが「本文の最初に出ちゃう」犯人なので確実に消す
    .replace(/\\setlength\{\\baselineskip\}\{[^}]*\}\s*/g, "")
    .replace(/\\baselineskip\s*=?\s*[^\\\n]*/g, "")

    // よく混ざるレイアウト系
    .replace(/\\hspace\*?\{[^}]*\}/g, "")
    .replace(/\\vspace\*?\{[^}]*\}/g, "")
    .replace(/\\(smallskip|medskip|bigskip)\b/g, "")
    .replace(/\\(noindent|par|indent)\b/g, "\n")
    .replace(/\\(newpage|clearpage|pagebreak|linebreak)\b(\[[^\]]*\])?/g, "\n")
    .replace(/\\(qquad|quad)\b/g, " ")
    .replace(/\\,/g, " ")

    // setlength類（他の長さも一括で消す）
    .replace(/\\setlength\{[^}]+\}\{[^}]+\}\s*/g, "")
    .replace(/\\addtolength\{[^}]+\}\{[^}]+\}\s*/g, "")

    // 図・外部ファイル
    .replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\input\{[^}]*\}/g, "")
    .replace(/\\include\{[^}]*\}/g, "")
    .replace(/\\bibliography\{[^}]*\}/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}/g, "")

    // tikz/picture系は丸ごと落とす
    .replace(/\\begin\{(tikzpicture|picture|pspicture|circuitikz)\}[\s\S]*?\\end\{\1\}/g, "")

    // phantom/raisebox
    .replace(/\\raisebox\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\(phantom|hphantom|vphantom)\{[^}]*\}/g, "")

    // color
    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\color\{[^}]*\}/g, "")

    // label/ref/cite
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "")
    .replace(/\\cite\{[^}]*\}/g, "")

    // document前後を削る
    .replace(/^[\s\S]*?\\begin\{document\}/, "")
    .replace(/\\end\{document\}[\s\S]*$/, "")

    // 前置き命令
    .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\pagestyle\{[^}]+\}/g, "")

    // 文字サイズ命令
    .replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, "")

    // 環境の整形
    .replace(/\\begin\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\end\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\begin\{(?:description|itemize|enumerate)\}/g, "\n")
    .replace(/\\end\{(?:description|itemize|enumerate)\}/g, "\n")

    // item整形
    .replace(/\\item\s*\[\s*\(([^)]+)\)\s*\]\s*/g, "\n（$1） ")
    .replace(/\\item\s*\[\s*([^\]]+)\s*\]\s*/g, "\n$1： ")
    .replace(/\\item\b\s*/g, "\n・ ")

    // {4} みたいな行頭番号をQNUMタグへ（あなたの仕様）
    .replace(/^\s*\{(\d+)\}\s*$/m, "[[QNUM:$1]]")
    .replace(/\{\s*\\huge\s+(\d+)\s*\}/g, "[[QNUM:$1]]")

    // 仕上げ
    .replace(/\u3000+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
