window.MathJax = {
  loader: { load: ['[tex]/noerrors', '[tex]/noundefined'] },
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    packages: { '[+]': ['noerrors', 'noundefined'] }
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea'],
    renderActions: { addMenu: [] }
  }
};

