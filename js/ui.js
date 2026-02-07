// js/ui.js
import { normalizeQuery } from "./latex.js";

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

/**
 * toolbar を timeline の直前に挿入して返す
 * @returns { searchInput, clearBtn, sortToggle }
 */
export function buildToolbar(timeline, { onSortToggle } = {}) {
  if (!timeline) throw new Error("buildToolbar: timeline が未指定です");

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  const toolbarInner = document.createElement("div");
  toolbarInner.className = "toolbar-inner";

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
  sortToggle.onclick = () => onSortToggle?.();

  toolbarInner.appendChild(searchInput);
  toolbarInner.appendChild(clearBtn);
  toolbarInner.appendChild(sortToggle);
  toolbar.appendChild(toolbarInner);

  // ★ ここで必ず timeline の直前に差し込む
  timeline.before(toolbar);

  // 初回同期（ヘッダー高さ）
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  return { searchInput, clearBtn, sortToggle };
}
