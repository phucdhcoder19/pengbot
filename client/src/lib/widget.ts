/** Đoạn mã công ty dán vào website của họ. publicKey là công khai, không phải bí mật. */
export function buildSnippet(publicKey: string) {
  return `<script src="https://pengbot-api.onrender.com/public/widget.js" data-key="${publicKey}" defer></script>`;
}
