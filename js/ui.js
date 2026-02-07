// /js/ui.js

export function syncHeaderHeight() {
  const h = document.querySelector("header")?.offsetHeight || 72;
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}

export function showNote(timeline, html) {
  if (!timeline) throw new Error("showNote: timeline がありません");
  const div = document.createElement("div");
  div.className = "system-note";
  div.innerHTML = html;
  timeline.prepend(div);
}

/**
 * timeline を必ず引数で受け取る版
 */
export function buildToolbar(timeline, { onInput, onClear, onSortToggle } = {}) {
  if (!timeline) throw new Error("buildToolbar: timeline が渡されていません");

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

  const sortBtn = document.createElement("button");
  sortBtn.textContent = "並び順：年度順";

  inner.appendChild(searchInput);
  inner.appendChild(clearBtn);
  inner.appendChild(sortBtn);
  toolbar.appendChild(inner);

  // ここで落ちてた：timeline が undefined
  timeline.before(toolbar);

  if (onInput) searchInput.addEventListener("input", onInput);

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
    if (onClear) onClear();
  });

  if (onSortToggle) sortBtn.addEventListener("click", onSortToggle);

  return { toolbar, toolbarInner: inner, searchInput, clearBtn, sortBtn };
}
