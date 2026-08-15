/** Đoạn mã công ty dán vào website của họ. publicKey là công khai, không phải bí mật. */
export function buildSnippet(publicKey: string) {
  return `<script src="https://cdn.pengbot.vn/widget.js" data-key="${publicKey}" defer></script>`;
}
