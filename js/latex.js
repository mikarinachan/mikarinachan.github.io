// js/latex.js

// 文字列検索用に正規化（小文字化＋全角半角などの揺れを吸収）
export function normalizeQuery(q) {
  return (q || "").trim().toLowerCase().normalize("NFKC");
}

// LaTeX → 表示用に正規化（MathJax非対応/レイアウト命令などを剥がす）
export function normalizeLatexForMathJax(tex) {
  return (tex ?? "")
    /* ---- 表示に出て欲しくないレイアウト系（今回の本命） ---- */
    // \setlength{\baselineskip}{22pt} など（表記ゆれ込みで全部消す）
    .replace(/\\setlength\s*\{\s*\\baselineskip\s*\}\s*\{\s*[^}]*\}/g, "")
    // \baselineskip=22pt みたいな単独指定も念のため
    .replace(/\\baselineskip\s*=?\s*[^\\\n]*/g, "")

    /* ---- 余白/改ページ ---- */
    .replace(/\\hspace\*?\{[^}]*\}/g, "")
    .replace(/\\vspace\*?\{[^}]*\}/g, "")
    .replace(/\\(smallskip|medskip|bigskip)\b/g, "")
    .replace(/\\(noindent|par|indent)\b/g, "\n")
    .replace(/\\(newpage|clearpage|pagebreak|linebreak)\b(\[[^\]]*\])?/g, "\n")
    .replace(/\\(qquad|quad)\b/g, " ")
    .replace(/\\,/g, " ")

    /* ---- setlength/addtolength（baselineskip以外も） ---- */
    .replace(/\\setlength\{[^}]+\}\{[^}]+\}/g, "")
    .replace(/\\addtolength\{[^}]+\}\{[^}]+\}/g, "")

    /* ---- 図・外部ファイル系 ---- */
    .replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\input\{[^}]*\}/g, "")
    .replace(/\\include\{[^}]*\}/g, "")
    .replace(/\\bibliography\{[^}]*\}/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}/g, "")

    /* ---- tikz/picture系 ---- */
    .replace(/\\begin\{(tikzpicture|picture|pspicture|circuitikz)\}[\s\S]*?\\end\{\1\}/g, "")

    /* ---- raisebox/phantom系 ---- */
    .replace(/\\raisebox\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\(phantom|hphantom|vphantom)\{[^}]*\}/g, "")

    /* ---- color系 ---- */
    .replace(/\\textcolor\{[^}]*\}\{([\s\S]*?)\}/g, "$1")
    .replace(/\\color\{[^}]*\}/g, "")

    /* ---- label/ref/cite ---- */
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "")
    .replace(/\\cite\{[^}]*\}/g, "")

    /* ---- document前後 ---- */
    .replace(/^[\s\S]*?\\begin\{document\}/, "")
    .replace(/\\end\{document\}[\s\S]*$/, "")

    /* ---- 前置き命令 ---- */
    .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\pagestyle\{[^}]+\}/g, "")

    /* ---- 文字サイズ命令 ---- */
    .replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, "")

    /* ---- 文章レイアウト環境 ---- */
    .replace(/\\begin\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\end\{(?:flushleft|center|flushright)\}/g, "")
    .replace(/\\begin\{(?:description|itemize|enumerate)\}/g, "\n")
    .replace(/\\end\{(?:description|itemize|enumerate)\}/g, "\n")

    /* ---- item整形 ---- */
    .replace(/\\item\s*\[\s*\(([^)]+)\)\s*\]\s*/g, "\n（$1） ")
    .replace(/\\item\s*\[\s*([^\]]+)\s*\]\s*/g, "\n$1： ")
    .replace(/\\item\b\s*/g, "\n・ ")

    /* ---- 問題番号タグ ---- */
    .replace(/^\s*\{(\d+)\}\s*$/m, "[[QNUM:$1]]")
    .replace(/\{\s*\\huge\s+(\d+)\s*\}/g, "[[QNUM:$1]]")

    /* ---- 整形 ---- */
    .replace(/\u3000+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
