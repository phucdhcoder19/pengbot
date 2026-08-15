import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { Request } from 'express';

async function bootstrap() {
  mkdirSync('uploads', { recursive: true }); // multer KHÔNG tự tạo thư mục
  const app = await NestFactory.create(AppModule);
  app.enableCors((req: Request, cb) => {
    if (req.url.startsWith('/public')) {
      // Widget nhúng trên web bên thứ ba → bắt buộc mở.
      // Hàng rào thật KHÔNG phải CORS mà là kiểm tra Origin theo
      // Tenant.allowedDomains, làm ở bước 5.
      cb(null, { origin: '*', credentials: false });
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
