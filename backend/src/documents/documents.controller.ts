import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../common/tenant/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { ALLOWED_EXTENSIONS } from '../ingest/extract-text';
import { extname } from 'path';

@Controller('api/documents')
@UseGuards(JwtAuthGuard) // gắn ở CONTROLLER, không gắn từng route — quên một route là thủng
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: './uploads',
        // Tên ngẫu nhiên, KHÔNG dùng originalname: khách có thể đặt tên
        // kiểu "../../.env" để ghi đè file hệ thống (path traversal).
        filename: (_req, file, cb) => {
          // Đuôi đã qua fileFilter nên chắc chắn nằm trong danh sách trắng
          // → ghép vào tên UUID là an toàn, không sợ path traversal.
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
          ? cb(null, true)
          : cb(
              new BadRequestException(
                `Chỉ nhận ${ALLOWED_EXTENSIONS.join(', ')}`,
              ),
              false,
            );
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    // fileFilter từ chối thì file = undefined, không phải ném lỗi
    if (!file) throw new BadRequestException('Thiếu file');
    return this.documents.createFromUpload(file);
  }

  @Get()
  findAll() {
    return this.documents.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }
}
