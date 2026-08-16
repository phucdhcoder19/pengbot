# Build context là thư mục client/.
#   docker build -t pengbot-client client/

# ─────────────────────────── 1. Biên dịch ───────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# ⚠️ Vite nhúng biến VITE_* vào bundle LÚC BUILD, không đọc lúc chạy.
# Nên địa chỉ API phải truyền vào từ đây; đổi nó là phải build lại image.
ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ─────────────────────────── 2. Phục vụ tĩnh ───────────────────────────
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
