// js/ui.js

export function syncHeaderHeight() {
  const h = document.querySelector("header")?.offsetHeight || 72;
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}

export function showNote(html) {
  const timeline = document.getElementById("timeline");
  if (!timeline) return;
  const div = document.createElement("div");
  div.className = "system-note";
  div.innerHTML = html;
  timeline.prepend(div);
}

/**
 * toolbar を作って timeline の「直前」に挿入する
 * 必ず timeline を引数で受け取る
 */
export function buildToolbar(
  timeline,
  { onInput, onClear, onSortToggle } = {}
) {
  if (!timeline) {
    throw new Error("buildToolbar: timeline が undefined");
  }

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const inner = document.createElement("div");
  inner.className = "toolbar-inner";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "検索（年度・大学名・本文）";
  searchInput.autocomplete = "off";

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "クリア";

  const sortBtn = document.createElement("button");
  sortBtn.textContent = "並び順：年度順";

  searchInput.addEventListener("input", () => {
    onInput?.(searchInput.value);
  });

  clearBtn.onclick = () => {
    searchInput.value = "";
    onClear?.();
  };

  sortBtn.onclick = () => {
    onSortToggle?.();
  };

  inner.appendChild(searchInput);
  inner.appendChild(clearBtn);
  inner.appendChild(sortBtn);
  toolbar.appendChild(inner);

  // ★ここがエラーの原因だった：timeline.before は timeline 必須
  timeline.before(toolbar);

  // header 高さ同期
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  return { searchInput, sortBtn };
}
