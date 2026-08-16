/**
 * Máy chủ tĩnh tí hon để thử widget, không phụ thuộc thư viện nào.
 *
 *   node widget/serve.js          → http://localhost:8080
 *
 * Vì sao cần: mở test.html bằng file:// thì Origin là "null", không phản ánh
 * đúng tình huống thật. Chạy ở cổng 8080 tạo ra một ORIGIN KHÁC hẳn backend
 * (3000) và dashboard (5173) — đúng như website của khách hàng ngoài đời.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT ?? 8080);
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

http
  .createServer((req, res) => {
    const url = req.url === '/' ? '/test.html' : req.url.split('?')[0];
    // Chặn path traversal: kẻ gọi /../../.env không được đi ra ngoài ROOT
    const file = path.join(ROOT, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));

    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Khong tim thay');
    }

    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store', // sửa file rồi F5 là thấy ngay
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`Website gia lap cua khach hang: http://localhost:${PORT}`);
  });
