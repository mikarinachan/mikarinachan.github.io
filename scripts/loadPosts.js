
async function loadPosts() {
  const res = await fetch("posts.json");
  const posts = await res.json();

  const container = document.getElementById("posts");

  for (const post of posts) {
    const texRes = await fetch(post.tex);
    const texText = await texRes.text();

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
