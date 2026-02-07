// js/ui.js

export function syncHeaderHeight() {
  const h = document.querySelector("header")?.offsetHeight || 72;
  document.documentElement.style.setProperty("--header-h", `${h}px`);
}

export function showNote(timeline, html) {
  if (!timeline) return;
  const div = document.createElement("div");
  div.className = "system-note";
  div.innerHTML = html;
  timeline.prepend(div);
}

export function buildToolbar(timeline) {
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

  const sortToggle = document.createElement("button");
  sortToggle.textContent = "並び順：年度順";

  toolbarInner.appendChild(searchInput);
  toolbarInner.appendChild(clearBtn);
  toolbarInner.appendChild(sortToggle);
  toolbar.appendChild(toolbarInner);

  // timeline の直前に挿入
  timeline.before(toolbar);

  // 返す（main.js側でイベントを貼る）
  return { toolbar, searchInput, clearBtn, sortToggle };
}

/**
 * 画面上に「JSエラーで停止しました」表示を出す（任意）
 */
export function attachGlobalErrorBanner(timeline) {
  const banner = document.createElement("div");
  banner.className = "system-note";
  banner.style.borderColor = "#f2b8b5";
  banner.style.background = "#fff4f4";
  banner.style.display = "none";
  banner.innerHTML =
    "❌ JavaScript エラーで描画が止まりました。<br>Console を確認してください。";

  timeline?.prepend(banner);

  window.addEventListener("error", () => {
    banner.style.display = "block";
  });
  window.addEventListener("unhandledrejection", () => {
    banner.style.display = "block";
  });
}
