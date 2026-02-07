async function fetchTextWithSJIS(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const uint8 = new Uint8Array(buf);
  const unicodeArray = Encoding.convert(uint8, { from: "SJIS", to: "UNICODE" });
  return Encoding.codeToString(unicodeArray);
}

async function loadPosts() {
  const res = await fetch("posts_index.json");
  const posts = await res.json();

  const container = document.getElementById("posts");

  for (const post of posts) {
    const texText = await fetchTextWithSJIS(post.tex);

    const section = document.createElement("section");
    section.className = "post";

    section.innerHTML = `
      <h2>${post.title}</h2>
      <div class="math">
${texText}
      </div>
      <hr>
    `;

    container.appendChild(section);
  }

  // MathJax 再描画
  if (window.MathJax) {
    MathJax.typesetPromise();
  }
}

loadPosts();
