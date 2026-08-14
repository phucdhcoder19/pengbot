import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { mkdirSync } from 'fs';

async function bootstrap() {
  mkdirSync('uploads', { recursive: true }); // multer KHÔNG tự tạo thư mục
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.CLIENT_URL, credentials: true });
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
