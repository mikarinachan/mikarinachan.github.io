import postsIndex from "../posts_index.json" assert { type: "json" };

let allPosts = [...postsIndex];
let currentPosts = [...postsIndex];
let currentSort = "new";

export function searchPosts(keyword) {
  if (!keyword) {
    currentPosts = [...allPosts];
    return currentPosts;
  }

  const k = keyword.toLowerCase();
  currentPosts = allPosts.filter(p =>
    p.id.toLowerCase().includes(k) ||
    p.source.toLowerCase().includes(k) ||
    String(p.date).includes(k)
  );
  return currentPosts;
}

export function sortPosts(type) {
  currentSort = type;
  const base = [...currentPosts];

  if (type === "new") {
    base.sort((a, b) => b.date - a.date);
  }
  if (type === "old") {
    base.sort((a, b) => a.date - b.date);
  }
  if (type === "no") {
    base.sort((a, b) => a.no - b.no);
  }

  currentPosts = base;
  return currentPosts;
}

export function getAllPosts() {
  currentPosts = [...allPosts];
  return currentPosts;
}
