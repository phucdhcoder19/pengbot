/**
 * Loader — phần DUY NHẤT website khách hàng tải lúc mở trang (~2KB).
 *
 * Cách dùng (không đổi so với trước):
 *   <script src="https://host/public/widget.js" data-key="pk_..."></script>
 *
 * Vì sao tách: 100% khách vào trang đều tải widget, nhưng chỉ vài % bấm mở
 * chat. Loader chỉ vẽ cái bong bóng; toàn bộ khung chat (core.js, ~13KB) chỉ
 * nạp khi người dùng thật sự bấm. Trang khách nhẹ hơn, điểm PageSpeed của họ
 * không bị widget kéo xuống. (Học từ cách Chatwoot tách SDK loader / app.)
 *
 * Hợp đồng với core.js: loader để lại đúng MỘT thứ trong window —
 *   window.__pengbotWidget = { key, api, config, root, wrap, bubble }
 * core.js đọc object này, dựng khung chat vào cùng Shadow root, gắn lại
 * sự kiện cho bubble, rồi mở khung ngay (vì người dùng vừa bấm).
 */
(function () {
  "use strict";

  // Nhúng snippet hai lần (SPA điều hướng lại, CMS chèn trùng) → bỏ qua lần sau
  if (window.__pengbotWidget) return;

  // document.currentScript chỉ đúng khi script đang chạy đồng bộ — phải đọc
  // NGAY, không được để trong callback.
  var script = document.currentScript;
  if (!script) return;

  var publicKey = script.getAttribute("data-key");
  if (!publicKey) {
    console.warn("[pengbot] thiếu data-key trên thẻ script");
    return;
  }

  // Suy ra địa chỉ API từ chính src của script này. Nhờ vậy khách không phải
  // cấu hình thêm gì, và đổi domain deploy cũng không phải sửa snippet.
  var API = new URL(script.src).origin;

  var W = (window.__pengbotWidget = {
    key: publicKey,
    api: API,
    config: {
      widgetTitle: "Chat với chúng tôi",
      widgetColor: "#0D9488",
      widgetGreeting: "Xin chào! Tôi có thể giúp gì cho bạn?",
    },
    root: null,
    wrap: null,
    bubble: null,
  });

  var loading = false;

  // CSS tối thiểu cho bong bóng. core.js sẽ thêm phần còn lại vào cùng root.
  var CSS = [
    ":host { all: initial; }",
    "*, *::before, *::after { box-sizing: border-box; }",
    ".wrap {",
    "  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;",
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    "  font-size: 14px; line-height: 1.5; color: #18181b;",
    "}",
    ".bubble {",
    "  width: 56px; height: 56px; border-radius: 50%; border: 0; cursor: pointer;",
    "  background: var(--c); color: #fff; display: grid; place-items: center;",
    "  box-shadow: 0 4px 16px rgba(0,0,0,.18); transition: transform .15s ease, opacity .15s ease;",
    "}",
    ".bubble:hover { transform: scale(1.05); }",
    ".bubble:focus-visible { outline: 3px solid var(--c); outline-offset: 3px; }",
    ".bubble.loading { opacity: .6; cursor: progress; }",
    "@media (prefers-reduced-motion: reduce) { .bubble { transition: none } }",
  ].join("\n");

  function build() {
    var host = document.createElement("div");
    // Shadow DOM: CSS bên trong không rò ra, CSS trang chủ nhà không lọt vào.
    W.root = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = CSS;

    W.wrap = document.createElement("div");
    W.wrap.className = "wrap";
    W.wrap.style.setProperty("--c", W.config.widgetColor);
    W.wrap.innerHTML =
      '<button class="bubble" aria-label="Mở hộp thoại hỗ trợ">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      "</svg></button>";

    W.root.appendChild(style);
    W.root.appendChild(W.wrap);
    document.body.appendChild(host);

    W.bubble = W.root.querySelector(".bubble");
    W.bubble.addEventListener("click", loadCore);
  }

  /// Nạp core.js đúng một lần, khi người dùng bấm bong bóng.
  function loadCore() {
    if (loading) return;
    loading = true;
    W.bubble.classList.add("loading");

    var s = document.createElement("script");
    s.src = API + "/public/widget-core.js";
    s.async = true;
    s.onload = function () {
      // core.js đã tự gắn lại sự kiện cho bubble và mở khung chat.
      W.bubble.classList.remove("loading");
      W.bubble.removeEventListener("click", loadCore);
    };
    s.onerror = function () {
      // Mạng lỗi / bị chặn → trả bong bóng về như cũ để bấm thử lại được.
      loading = false;
      W.bubble.classList.remove("loading");
      console.warn("[pengbot] không tải được widget-core.js");
    };
    document.head.appendChild(s);
  }

  function start() {
    // Lấy cấu hình giao diện (màu bong bóng cần ngay từ đầu). Hỏng thì vẫn
    // dựng với giá trị mặc định — thà widget xấu còn hơn không có widget.
    fetch(API + "/public/config?key=" + encodeURIComponent(publicKey))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (c) {
        if (c) W.config = Object.assign(W.config, c);
      })
      .catch(function () {})
      .finally(build);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
