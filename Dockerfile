# Build context là THƯ MỤC GỐC dự án, không phải backend/ — vì runtime cần cả
# widget/widget.js để phục vụ route /public/widget.js.
#   docker build -t pengbot-api .

# ─────────────────────────── 1. Cài dependency ───────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app/backend
# Chỉ copy manifest trước: sửa code mà không đổi dependency thì Docker dùng
# lại tầng này từ cache, khỏi cài lại từ đầu.
COPY backend/package*.json ./
RUN npm ci

# ─────────────────────────── 2. Biên dịch ───────────────────────────
FROM node:24-alpine AS build
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ ./
# prisma generate PHẢI chạy trước nest build: thư mục generated/ được import
# từ src/prisma/prisma.ts, không có nó thì biên dịch hỏng.
RUN npx prisma generate && npm run build

# ─────────────────────────── 3. Chạy ───────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev

# Prisma CLI là devDependency nên không có trong bản cài trên. Nhưng container
# cần nó để chạy `migrate deploy` lúc khởi động → copy riêng đúng hai thư mục,
# rẻ hơn nhiều so với cài cả devDependencies.
COPY --from=build /app/backend/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/backend/node_modules/.bin/prisma ./node_modules/.bin/prisma

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/generated ./generated
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts

# widget/ nằm ngoài backend/ nên cần build context ở thư mục gốc
COPY widget /app/widget
ENV WIDGET_PATH=/app/widget/widget.js

# File khách upload. Gắn volume vào đây nếu muốn giữ lại tài liệu FAILED
# để điều tra; bình thường file được xoá ngay sau khi ingest thành công.
RUN mkdir -p uploads

# Chạy bằng user không phải root
USER node

EXPOSE 3000

# generated/ nằm ngoài src/ nên tsc đẩy output thành dist/src/main.js,
# KHÔNG phải dist/main.js.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
