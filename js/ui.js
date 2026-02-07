// js/ui.js

export function syncHeaderHeight() {
  const h = document.querySelector("header")?.offsetHeight || 72;
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}

export function showNote(timeline, html) {
  const div = document.createElement("div");
  div.className = "system-note";
  div.innerHTML = html;
  timeline.prepend(div);
}

export function buildToolbar({ timeline, onSortToggle }) {
  if (!timeline) throw new Error("buildToolbar: timeline がありません");

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const inner = document.createElement("div");
  inner.className = "toolbar-inner";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "検索（例: 2025 / 6 / 複素数 / Re / 4a+1 など）";
  searchInput.autocomplete = "off";

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "クリア";
  clearBtn.onclick = () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
  };

  const sortToggle = document.createElement("button");
  sortToggle.textContent = "並び順：年度順";
  sortToggle.onclick = () => onSortToggle?.(sortToggle);

  inner.appendChild(searchInput);
  inner.appendChild(clearBtn);
  inner.appendChild(sortToggle);
  toolbar.appendChild(inner);

  // ★ここが以前のエラー原因になりやすいので安全に
  timeline.parentNode?.insertBefore(toolbar, timeline);

  // header高さ同期
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  return { toolbar, searchInput, clearBtn, sortToggle };
}
