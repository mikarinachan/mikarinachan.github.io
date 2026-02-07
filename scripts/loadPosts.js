async function fetchTextWithSJIS(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const uint8 = new Uint8Array(buf);
  const unicodeArray = Encoding.convert(uint8, { from: "SJIS", to: "UNICODE" });
  return Encoding.codeToString(unicodeArray);
}

async function loadPosts() {
  const res = await fetch("posts_index.json"); // ★置き換え①
  const posts = await res.json();

  const container = document.getElementById("timeline"); // ★置き換え②

  for (const post of posts) {
    const texText = await fetchTextWithSJIS(post.tex);

    const section = document.createElement("section");
    section.className = "post";

    section.innerHTML = `
      <h2>${post.title ?? ""}</h2>
      <div class="math">
${texText}
      </div>
      <hr>
    `;

    container.appendChild(section);
  }

  if (window.MathJax) {
    await MathJax.typesetPromise();
  }
}

loadPosts();
