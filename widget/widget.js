/**
 * Widget chat nhúng — JavaScript thuần, không phụ thuộc thư viện nào.
 *
 * Cách dùng:
 *   <script src="https://host/public/widget.js" data-key="pk_..."></script>
 *
 * Ràng buộc thiết kế (file này chạy trên website của NGƯỜI KHÁC):
 *   - Toàn bộ CSS nằm trong Shadow DOM → không đụng style của trang chủ nhà,
 *     và style của họ cũng không phá được widget.
 *   - Chỉ chiếm đúng một tên trong window: __pengbotWidget (dùng làm cờ chống
 *     nhúng hai lần).
 *   - Không chặn quá trình tải trang: mọi thứ chạy sau khi DOM sẵn sàng.
 */
(function () {
  'use strict';

  // Nhúng snippet hai lần (SPA điều hướng lại, CMS chèn trùng) → bỏ qua lần sau
  if (window.__pengbotWidget) return;
  window.__pengbotWidget = true;

  // document.currentScript chỉ đúng khi script đang chạy đồng bộ — phải đọc
  // NGAY, không được để trong callback.
  var script = document.currentScript;
  if (!script) return;

  var publicKey = script.getAttribute('data-key');
  if (!publicKey) {
    console.warn('[pengbot] thiếu data-key trên thẻ script');
    return;
  }

  // Suy ra địa chỉ API từ chính src của script này. Nhờ vậy khách không phải
  // cấu hình thêm gì, và đổi domain deploy cũng không phải sửa snippet.
  var API = new URL(script.src).origin;

  var STORE_VISITOR = 'pengbot_visitor';
  var STORE_CONV = 'pengbot_conv_' + publicKey;

  // ───────────────────────── trạng thái ─────────────────────────

  var config = {
    widgetTitle: 'Chat với chúng tôi',
    widgetColor: '#0D9488',
    widgetGreeting: 'Xin chào! Tôi có thể giúp gì cho bạn?',
  };
  var open = false;
  var sending = false;
  var root, panel, bubble, listEl, inputEl, sendBtn;

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
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      store(STORE_VISITOR, id);
    }
    return id;
  }

  // ───────────────────────── giao diện ─────────────────────────

  function css() {
    return [
      ':host { all: initial; }',
      '*, *::before, *::after { box-sizing: border-box; }',
      '.wrap {',
      '  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  font-size: 14px; line-height: 1.5; color: #18181b;',
      '}',
      '.bubble {',
      '  width: 56px; height: 56px; border-radius: 50%; border: 0; cursor: pointer;',
      '  background: var(--c); color: #fff; display: grid; place-items: center;',
      '  box-shadow: 0 4px 16px rgba(0,0,0,.18); transition: transform .15s ease;',
      '}',
      '.bubble:hover { transform: scale(1.05); }',
      '.bubble:focus-visible { outline: 3px solid var(--c); outline-offset: 3px; }',
      '.panel {',
      '  position: absolute; right: 0; bottom: 72px; width: 360px; height: 520px;',
      '  max-width: calc(100vw - 40px); max-height: calc(100vh - 120px);',
      '  background: #fff; border-radius: 14px; overflow: hidden;',
      '  display: none; flex-direction: column;',
      '  box-shadow: 0 12px 40px rgba(0,0,0,.18);',
      '}',
      '.panel.open { display: flex; }',
      '.head {',
      '  background: var(--c); color: #fff; padding: 14px 16px;',
      '  display: flex; align-items: center; justify-content: space-between;',
      '}',
      '.head h3 { margin: 0; font-size: 15px; font-weight: 600; }',
      '.close { background: none; border: 0; color: #fff; cursor: pointer; padding: 4px; opacity: .85; }',
      '.close:hover { opacity: 1; }',
      '.list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }',
      '.msg { max-width: 85%; padding: 10px 13px; border-radius: 12px; white-space: pre-wrap; word-wrap: break-word; }',
      '.msg.bot { background: #f4f4f5; align-self: flex-start; border-bottom-left-radius: 4px; }',
      '.msg.me  { background: var(--c); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }',
      '.cites { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }',
      '.cite {',
      '  font-size: 11px; background: #fff; border: 1px solid #e4e4e7;',
      '  border-radius: 999px; padding: 3px 9px; color: #52525b;',
      '}',
      '.dots { display: flex; gap: 4px; padding: 12px 13px; }',
      '.dots i { width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; animation: b 1.2s infinite; }',
      '.dots i:nth-child(2) { animation-delay: .2s } .dots i:nth-child(3) { animation-delay: .4s }',
      '@keyframes b { 0%,60%,100% { opacity: .3 } 30% { opacity: 1 } }',
      '.foot { border-top: 1px solid #e4e4e7; padding: 10px; display: flex; gap: 8px; }',
      '.foot input {',
      '  flex: 1; border: 1px solid #e4e4e7; border-radius: 8px; padding: 9px 12px;',
      '  font: inherit; color: inherit; outline: none;',
      '}',
      '.foot input:focus { border-color: var(--c); }',
      '.foot button {',
      '  background: var(--c); color: #fff; border: 0; border-radius: 8px;',
      '  padding: 0 16px; cursor: pointer; font: inherit; font-weight: 500;',
      '}',
      '.foot button:disabled { opacity: .5; cursor: default; }',
      '@media (max-width: 420px) {',
      '  .panel { width: calc(100vw - 40px); height: calc(100vh - 120px); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .bubble { transition: none } .dots i { animation: none; opacity: .6 }',
      '}',
    ].join('\n');
  }

  function build() {
    var host = document.createElement('div');
    // Shadow DOM: CSS bên trong không rò ra, CSS trang chủ nhà không lọt vào.
    // Thiếu nó là widget vỡ giao diện trên mọi website có CSS reset khác nhau.
    root = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = css();

    var wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.style.setProperty('--c', config.widgetColor);

    wrap.innerHTML = [
      '<div class="panel" role="dialog" aria-modal="false" aria-label="Hộp thoại hỗ trợ">',
      '  <div class="head">',
      '    <h3></h3>',
      '    <button class="close" aria-label="Đóng">✕</button>',
      '  </div>',
      '  <div class="list" role="log" aria-live="polite"></div>',
      '  <form class="foot">',
      '    <input type="text" placeholder="Nhập câu hỏi..." aria-label="Câu hỏi" autocomplete="off">',
      '    <button type="submit">Gửi</button>',
      '  </form>',
      '</div>',
      '<button class="bubble" aria-label="Mở hộp thoại hỗ trợ">',
      '  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
      '  </svg>',
      '</button>',
    ].join('');

    root.appendChild(style);
    root.appendChild(wrap);
    document.body.appendChild(host);

    panel = root.querySelector('.panel');
    bubble = root.querySelector('.bubble');
    listEl = root.querySelector('.list');
    inputEl = root.querySelector('.foot input');
    sendBtn = root.querySelector('.foot button');
    root.querySelector('.head h3').textContent = config.widgetTitle;

    bubble.addEventListener('click', toggle);
    root.querySelector('.close').addEventListener('click', toggle);
    root.querySelector('.foot').addEventListener('submit', onSubmit);

    // Esc đóng hộp thoại — nghe ở document vì tiêu điểm có thể đang ở ngoài
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) toggle();
    });
  }

  function toggle() {
    open = !open;
    panel.classList.toggle('open', open);
    if (open) {
      if (!listEl.children.length) addMsg('bot', config.widgetGreeting);
      inputEl.focus();
    } else {
      bubble.focus(); // trả tiêu điểm về nút, để dùng bàn phím không bị lạc
    }
  }

  // ───────────────────────── tin nhắn ─────────────────────────

  function addMsg(who, text, citations) {
    var el = document.createElement('div');
    el.className = 'msg ' + who;
    // textContent chứ KHÔNG innerHTML: nội dung do LLM sinh ra, chèn thẳng
    // vào HTML là mở đường cho XSS ngay trên website của khách hàng.
    el.textContent = text || '';

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
    var gan = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;
    if (gan) listEl.scrollTop = listEl.scrollHeight;
  }

  function addCites(el, citations) {
    var box = document.createElement('div');
    box.className = 'cites';
    citations.forEach(function (c) {
      var chip = document.createElement('span');
      chip.className = 'cite';
      chip.textContent = '📄 ' + c.title;
      box.appendChild(chip);
    });
    el.appendChild(box);
  }

  function typing(on) {
    var old = root.querySelector('.dots');
    if (old) old.remove();
    if (!on) return;
    var el = document.createElement('div');
    el.className = 'msg bot dots';
    el.innerHTML = '<i></i><i></i><i></i>';
    listEl.appendChild(el);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function onSubmit(e) {
    e.preventDefault();
    var text = inputEl.value.trim();
    if (!text || sending) return;

    inputEl.value = '';
    addMsg('me', text);
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
    sendBtn.disabled = false;
    inputEl.focus();
  }

  function loi() {
    typing(false);
    addMsg('bot', 'Xin lỗi, không kết nối được. Bạn thử lại sau nhé.');
  }

  function send(text) {
    sending = true;
    sendBtn.disabled = true;
    typing(true);

    fetch(API + '/public/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload(text),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        // Trình duyệt quá cũ không có ReadableStream → quay về bản không stream
        if (!r.body || !r.body.getReader) return sendPlain(text);
        return readStream(r);
      })
      .catch(function () {
        // Endpoint stream hỏng (proxy chặn SSE chẳng hạn) → thử bản thường
        return sendPlain(text).catch(loi);
      })
      .finally(done);
  }

  /// Đọc Server-Sent Events và vẽ chữ dần lên màn hình.
  function readStream(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var el = null; // bong bóng của bot, chỉ tạo khi có chữ đầu tiên

    function handle(raw) {
      if (raw.indexOf('data: ') !== 0) return;
      var ev;
      try {
        ev = JSON.parse(raw.slice(6));
      } catch (e) {
        return; // mẩu JSON hỏng thì bỏ qua, đừng làm sập cả luồng
      }

      if (ev.type === 'meta') {
        // Lưu conversationId NGAY, trước cả chữ đầu tiên. Mạng đứt giữa chừng
        // thì lượt sau vẫn nối đúng phiên.
        if (ev.conversationId) store(STORE_CONV, ev.conversationId);
      } else if (ev.type === 'delta') {
        if (!el) {
          typing(false); // tắt ba chấm đúng lúc chữ đầu tiên xuất hiện
          el = addMsg('bot', '');
        }
        appendText(el, ev.text);
      } else if (ev.type === 'done') {
        if (el && ev.citations && ev.citations.length) addCites(el, ev.citations);
      } else if (ev.type === 'error') {
        typing(false);
        if (!el) addMsg('bot', ev.message);
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
        var parts = buffer.split('\n\n');
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
    return fetch(API + '/public/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload(text),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        typing(false);
        if (data.conversationId) store(STORE_CONV, data.conversationId);
        addMsg('bot', data.answer, data.citations);
      });
  }

  // ───────────────────────── khởi động ─────────────────────────

  function start() {
    // Lấy cấu hình giao diện. Hỏng thì vẫn dựng widget với giá trị mặc định —
    // thà widget xấu còn hơn không có widget.
    fetch(API + '/public/config?key=' + encodeURIComponent(publicKey))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (c) {
        if (c) config = Object.assign(config, c);
      })
      .catch(function () {})
      .finally(build);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
