# Demo — website của một khách hàng dùng Pengbot

`index.html` giả lập website của **Pengu Coffee**, một xưởng cà phê có gắn chatbot
Pengbot. Thanh tối trên cùng chỉ để điều khiển demo; website thật của khách
chỉ cần đúng một thẻ `<script>`.

## Chạy

```bash
npx serve demo              # → http://localhost:3000 (hoặc cổng serve báo)
```

Hoặc deploy thư mục `demo/` thành một site tĩnh (Vercel: tạo project mới,
Root Directory = `demo`, không cần build).

Mặc định trang gọi backend đã deploy `https://pengbot-api.onrender.com`. Chạy
backend local thì mở `?api=http://localhost:3000` một lần, trang sẽ nhớ.

## Kịch bản demo

1. Dashboard → đăng ký tài khoản (mỗi tài khoản = một công ty).
2. **Documents** → upload [`tai-lieu-mau.md`](tai-lieu-mau.md), chờ **READY**.
3. **Settings** → copy publicKey → dán vào thanh trên cùng → **Nhúng widget**.
4. Bấm bong bóng chat, thử các câu hỏi gợi ý trong mục **Hướng dẫn**.
5. Quay lại dashboard → **Conversations** / **Overview**.

Gửi link có sẵn key cho người khác xem: `https://<site-demo>/?key=pk_...`

> Nếu Settings đã khai báo `allowedDomains`, phải thêm domain của trang demo
> vào đó, không thì widget bị chặn 403 (thanh trạng thái sẽ báo).
