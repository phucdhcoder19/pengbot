import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { Request } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  mkdirSync('uploads', { recursive: true }); // multer KHÔNG tự tạo thư mục
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sau nginx/Cloudflare thì req.ip là IP của proxy, không phải của khách —
  // trần rate limit theo IP sẽ gộp cả thế giới vào một rọ. Bật TRUST_PROXY để
  // Express đọc X-Forwarded-For.
  //
  // ⚠️ MẶC ĐỊNH TẮT, và phải đặt đúng số tầng proxy (TRUST_PROXY=1) chứ đừng
  // để "true": tin header đó vô điều kiện nghĩa là ai cũng tự khai IP của
  // mình được, và trần theo IP thành vô dụng.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  app.enableCors((req: Request, cb) => {
    if (req.url.startsWith('/public')) {
      // Widget nhúng trên web bên thứ ba → bắt buộc mở.
      // Hàng rào thật KHÔNG phải CORS mà là kiểm tra Origin theo
      // Tenant.allowedDomains, làm ở bước 5.
      // exposedHeaders: mặc định JS bên kia origin không đọc được header nào
      // ngoài vài header an toàn — không khai thì widget không thấy Retry-After.
      cb(null, {
        origin: '*',
        credentials: false,
        exposedHeaders: ['Retry-After'],
      });
    } else {
      // Dashboard: chỉ đúng một origin, có gửi cookie/credentials
      cb(null, { origin: process.env.CLIENT_URL, credentials: true });
    }
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // cắt field lạ không khai trong DTO
      forbidNonWhitelisted: true, // có field lạ → báo lỗi luôn
      transform: true, // biến body thành instance của DTO
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
