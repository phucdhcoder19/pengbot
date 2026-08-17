/**
 * Widget chat nhúng — phần THÂN. JavaScript thuần, không phụ thuộc thư viện nào.
 *
 * File này KHÔNG được nhúng trực tiếp. Snippet của khách trỏ vào loader.js
 * (phục vụ tại /public/widget.js); loader vẽ bong bóng và chỉ nạp file này
 * (tại /public/widget-core.js) khi người dùng bấm. Xem loader.js.
 *
 * Hợp đồng với loader: window.__pengbotWidget = { key, api, config, root,
 * wrap, bubble } đã có sẵn. Ở đây ta dựng khung chat vào cùng Shadow root,
 * gắn lại sự kiện cho bubble, rồi mở khung ngay.
 *
 * Ràng buộc thiết kế (file này chạy trên website của NGƯỜI KHÁC):
 *   - Toàn bộ CSS nằm trong Shadow DOM → không đụng style của trang chủ nhà,
 *     và style của họ cũng không phá được widget.
 *   - Chỉ chiếm đúng một tên trong window: __pengbotWidget (loader đặt).
 */
(function () {
  "use strict";

  var W = window.__pengbotWidget;
  // Bị nạp không qua loader, hoặc nạp hai lần → không có gì để làm
  if (!W || !W.root || W.mounted) return;
  W.mounted = true;

  var publicKey = W.key;
  var API = W.api;
  var config = W.config;

  var STORE_VISITOR = "pengbot_visitor";
  var STORE_CONV = "pengbot_conv_" + publicKey;

  // ───────────────────────── trạng thái ─────────────────────────

  var open = false;
  var sending = false;
  /// Mốc thời gian được phép gửi lại sau khi bị 429 (0 = không bị khoá).
  var blockedUntil = 0;
  var root = W.root;
  var wrap = W.wrap;
  var bubble = W.bubble;
  var panel, listEl, inputEl, sendBtn;

  // localStorage có thể ném lỗi: chế độ riêng tư, cookie bị chặn, hết dung
  // lượng. Widget vẫn phải chạy được, chỉ là không nhớ phiên giữa các lần.
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
  }

  function visitorId() {
    var id = store(STORE_VISITOR);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "v_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      store(STORE_VISITOR, id);
    }
    return id;
  }

  // ───────────────────────── giao diện ─────────────────────────

  /// CSS cho khung chat. Phần :host / .wrap / .bubble đã nằm trong loader.js.
  function css() {
    return [
      ".panel {",
      "  position: absolute; right: 0; bottom: 72px; width: 360px; height: 520px;",
      "  max-width: calc(100vw - 40px); max-height: calc(100vh - 120px);",
      "  background: #fff; border-radius: 14px; overflow: hidden;",
      "  display: none; flex-direction: column;",
      "  box-shadow: 0 12px 40px rgba(0,0,0,.18);",
      "}",
      ".panel.open { display: flex; }",
      ".head {",
      "  background: var(--c); color: #fff; padding: 14px 16px;",
      "  display: flex; align-items: center; justify-content: space-between;",
      "}",
      ".head h3 { margin: 0; font-size: 15px; font-weight: 600; }",
      ".close { background: none; border: 0; color: #fff; cursor: pointer; padding: 4px; opacity: .85; }",
      ".close:hover { opacity: 1; }",
      ".list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }",
      ".msg { max-width: 85%; padding: 10px 13px; border-radius: 12px; white-space: pre-wrap; word-wrap: break-word; }",
      ".msg.bot { background: #f4f4f5; align-self: flex-start; border-bottom-left-radius: 4px; }",
      ".msg.me  { background: var(--c); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }",
      ".cites { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }",
      ".cite {",
      "  font-size: 11px; background: #fff; border: 1px solid #e4e4e7;",
      "  border-radius: 999px; padding: 3px 9px; color: #52525b;",
      "}",
      ".dots { display: flex; gap: 4px; padding: 12px 13px; }",
      ".dots i { width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; animation: b 1.2s infinite; }",
      ".dots i:nth-child(2) { animation-delay: .2s } .dots i:nth-child(3) { animation-delay: .4s }",
      "@keyframes b { 0%,60%,100% { opacity: .3 } 30% { opacity: 1 } }",
      ".foot { border-top: 1px solid #e4e4e7; padding: 10px; display: flex; gap: 8px; }",
      ".foot input {",
      "  flex: 1; border: 1px solid #e4e4e7; border-radius: 8px; padding: 9px 12px;",
      "  font: inherit; color: inherit; outline: none;",
      "}",
      ".foot input:focus { border-color: var(--c); }",
      ".foot button {",
      "  background: var(--c); color: #fff; border: 0; border-radius: 8px;",
      "  padding: 0 16px; cursor: pointer; font: inherit; font-weight: 500;",
      "}",
      ".foot button:disabled { opacity: .5; cursor: default; }",
      "@media (max-width: 420px) {",
      "  .panel { width: calc(100vw - 40px); height: calc(100vh - 120px); }",
      "}",
      "@media (prefers-reduced-motion: reduce) {",
      "  .dots i { animation: none; opacity: .6 }",
      "}",
    ].join("\n");
  }

  function build() {
    // Shadow root, .wrap và .bubble đã do loader dựng. Ở đây chỉ thêm CSS và
    // khung chat vào đúng chỗ đó.
    var style = document.createElement("style");
    style.textContent = css();
    root.appendChild(style);

    panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", "Hộp thoại hỗ trợ");
    panel.innerHTML = [
      '<div class="head">',
      "  <h3></h3>",
      '  <button class="close" aria-label="Đóng">✕</button>',
      "</div>",
      '<div class="list" role="log" aria-live="polite"></div>',
      '<form class="foot">',
      '  <input type="text" placeholder="Nhập câu hỏi..." aria-label="Câu hỏi" autocomplete="off">',
      '  <button type="submit">Gửi</button>',
      "</form>",
    ].join("");
    // Chèn TRƯỚC bubble để giữ đúng thứ tự tab như bản cũ (khung → nút).
    wrap.insertBefore(panel, bubble);

    listEl = panel.querySelector(".list");
    inputEl = panel.querySelector(".foot input");
    sendBtn = panel.querySelector(".foot button");
    panel.querySelector(".head h3").textContent = config.widgetTitle;

    // Loader đã gỡ handler "nạp core" của nó khỏi bubble (trong onload).
    // Từ giờ bubble là nút đóng/mở bình thường.
    bubble.addEventListener("click", toggle);
    panel.querySelector(".close").addEventListener("click", toggle);
    panel.querySelector(".foot").addEventListener("submit", onSubmit);

    // Esc đóng hộp thoại — nghe ở document vì tiêu điểm có thể đang ở ngoài
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) toggle();
    });
  }

  function toggle() {
    open = !open;
    panel.classList.toggle("open", open);
    if (open) {
      if (!listEl.children.length) addMsg("bot", config.widgetGreeting);
      inputEl.focus();
    } else {
      bubble.focus(); // trả tiêu điểm về nút, để dùng bàn phím không bị lạc
    }
  }

  // ───────────────────────── tin nhắn ─────────────────────────

  function addMsg(who, text, citations) {
    var el = document.createElement("div");
    el.className = "msg " + who;
    // textContent chứ KHÔNG innerHTML: nội dung do LLM sinh ra, chèn thẳng
    // vào HTML là mở đường cho XSS ngay trên website của khách hàng.
    el.textContent = text || "";

    if (citations && citations.length) addCites(el, citations);

    listEl.appendChild(el);
    listEl.scrollTop = listEl.scrollHeight;
    return el;
  }

  /// Nối thêm chữ vào bong bóng đang có — dùng khi stream.
  /// Cộng vào textContent chứ không dựng lại phần tử, để trình duyệt chỉ phải
  /// vẽ lại phần thay đổi.
  function appendText(el, text) {
    el.textContent += text;
    // Chỉ tự cuộn nếu khách đang ở gần đáy. Họ cuộn lên đọc lại đoạn cũ mà bị
    // giật xuống mỗi lần có chữ mới thì rất khó chịu.
    var nearBottom =
      listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;
    if (nearBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  function addCites(el, citations) {
    var box = document.createElement("div");
    box.className = "cites";
    citations.forEach(function (c) {
      var chip = document.createElement("span");
      chip.className = "cite";
      chip.textContent = "📄 " + c.title;
      box.appendChild(chip);
    });
    el.appendChild(box);
  }

  function typing(on) {
    var old = root.querySelector(".dots");
    if (old) old.remove();
    if (!on) return;
    var el = document.createElement("div");
    el.className = "msg bot dots";
    el.innerHTML = "<i></i><i></i><i></i>";
    listEl.appendChild(el);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function onSubmit(e) {
    e.preventDefault();
    var text = inputEl.value.trim();
    if (!text || sending || Date.now() < blockedUntil) return;

    inputEl.value = "";
    addMsg("me", text);
    send(text);
  }

  function payload(text) {
    return JSON.stringify({
      publicKey: publicKey,
      message: text,
      conversationId: store(STORE_CONV) || undefined,
      visitorId: visitorId(),
    });
  }

  function done() {
    sending = false;
    // Đang bị khoá vì 429 thì để nguyên; hẹn giờ trong lockSending() sẽ mở lại.
    if (Date.now() >= blockedUntil) {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function showConnectionError() {
    typing(false);
    addMsg("bot", "Xin lỗi, không kết nối được. Bạn thử lại sau nhé.");
  }

  /**
   * 429 — vượt hạn mức. Server đã soạn sẵn câu tiếng Việt cho người dùng cuối
   * trong body, cứ hiện nguyên văn.
   *
   * Phải xử lý RIÊNG, không để rơi vào catch chung: catch chung sẽ thử lại
   * bằng /public/chat, mà endpoint đó cũng đang bị chặn — thành ra tốn thêm
   * một request nữa rồi hiện nhầm "không kết nối được".
   */
  function showRateLimited(res) {
    return res
      .json()
      .catch(function () {
        return {};
      })
      .then(function (body) {
        typing(false);
        addMsg(
          "bot",
          body.message || "Bạn đang gửi hơi nhanh, thử lại sau ít phút nhé.",
        );
        // Khoá ô nhập tới lúc được phép gửi lại. Để khách gõ tiếp rồi lại ăn
        // 429 nữa thì vừa vô ích vừa khó chịu. Trần 60 giây để quota tháng
        // (resetAt còn cách hàng tuần) không khoá widget vĩnh viễn.
        var waitSec = Math.min(Number(body.retryAfterSec) || 0, 60);
        if (waitSec > 0) lockSending(waitSec);
      });
  }

  function lockSending(seconds) {
    blockedUntil = Date.now() + seconds * 1000;
    sendBtn.disabled = true;
    inputEl.disabled = true;
    setTimeout(function () {
      blockedUntil = 0;
      sendBtn.disabled = false;
      inputEl.disabled = false;
    }, seconds * 1000);
  }

  function send(text) {
    sending = true;
    sendBtn.disabled = true;
    typing(true);

    fetch(API + "/public/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload(text),
    })
      .then(function (r) {
        if (r.status === 429) return showRateLimited(r);
        if (!r.ok) throw new Error("HTTP " + r.status);
        // Trình duyệt quá cũ không có ReadableStream → quay về bản không stream
        if (!r.body || !r.body.getReader) return sendPlain(text);
        return readStream(r);
      })
      .catch(function () {
        // Endpoint stream hỏng (proxy chặn SSE chẳng hạn) → thử bản thường
        return sendPlain(text).catch(showConnectionError);
      })
      .finally(done);
  }

  /// Đọc Server-Sent Events và vẽ chữ dần lên màn hình.
  function readStream(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var el = null; // bong bóng của bot, chỉ tạo khi có chữ đầu tiên

    function handle(raw) {
      if (raw.indexOf("data: ") !== 0) return;
      var ev;
      try {
        ev = JSON.parse(raw.slice(6));
      } catch (e) {
        return; // mẩu JSON hỏng thì bỏ qua, đừng làm sập cả luồng
      }

      if (ev.type === "meta") {
        // Lưu conversationId NGAY, trước cả chữ đầu tiên. Mạng đứt giữa chừng
        // thì lượt sau vẫn nối đúng phiên.
        if (ev.conversationId) store(STORE_CONV, ev.conversationId);
      } else if (ev.type === "delta") {
        if (!el) {
          typing(false); // tắt ba chấm đúng lúc chữ đầu tiên xuất hiện
          el = addMsg("bot", "");
        }
        appendText(el, ev.text);
      } else if (ev.type === "done") {
        if (el && ev.citations && ev.citations.length)
          addCites(el, ev.citations);
      } else if (ev.type === "error") {
        typing(false);
        if (!el) addMsg("bot", ev.message);
      }
    }

    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          typing(false);
          return;
        }
        buffer += decoder.decode(r.value, { stream: true });
        // Sự kiện SSE cách nhau bằng dòng trống. Gói TCP có thể cắt giữa chừng
        // nên phần đuôi chưa trọn vẹn được giữ lại cho vòng sau.
        var parts = buffer.split("\n\n");
        buffer = parts.pop();
        parts.forEach(function (p) {
          handle(p.trim());
        });
        return pump();
      });
    }

    return pump();
  }

  /// Bản dự phòng: gọi endpoint JSON thường, hiện cả câu một lúc.
  function sendPlain(text) {
    return fetch(API + "/public/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload(text),
    })
      .then(function (r) {
        // Đường dự phòng cũng bị chặn như đường stream — xử lý y hệt.
        if (r.status === 429)
          return showRateLimited(r).then(function () {
            return null;
          });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data) return; // đã hiện thông báo ở nhánh 429
        typing(false);
        if (data.conversationId) store(STORE_CONV, data.conversationId);
        addMsg("bot", data.answer, data.citations);
      });
  }

  // ───────────────────────── khởi động ─────────────────────────

  // Loader đã lấy config và DOM đã sẵn sàng từ lâu. Người dùng vừa bấm bong
  // bóng để nạp file này → dựng xong là mở ngay, không bắt họ bấm lần hai.
  build();
  toggle();
})();
