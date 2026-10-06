import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type ExtendedPrismaClient, PRISMA } from '../prisma/prisma';
import { CreateDocumentDto } from './dto/create-document.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { INGEST_QUEUE, type IngestJob } from '../ingest/ingest.processor';
import { Queue } from 'bullmq';
import { extname } from 'node:path';
import { SOURCE_TYPE_BY_EXT } from '../ingest/extract-text';
import { SourceType } from 'generated/prisma/enums';
import { unlink } from 'node:fs/promises';
import {
  throttledRedisErrorLogger,
  withTimeout,
} from '../common/redis/redis-resilience';

/// Redis chết thì queue.add treo vô hạn (BullMQ không bao giờ bỏ cuộc) —
/// cắt ở đây để request upload trả lỗi thay vì treo.
const ENQUEUE_TIMEOUT_MS = 5000;

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly log = new Logger(DocumentsService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    @InjectQueue(INGEST_QUEUE) private readonly queue: Queue<IngestJob>,
  ) {}

  onModuleInit() {
    // Không nghe 'error' thì BullMQ console.error nguyên stack mỗi lần reconnect.
    this.queue.on('error', throttledRedisErrorLogger(`${INGEST_QUEUE}:queue`));
  }

  async createFromUpload(file: Express.Multer.File) {
    const ext = extname(file.originalname).toLowerCase();
    const doc = await this.prisma.document.create({
      data: {
        title: file.originalname.replace(/\.[^.]+$/, ''),
        sourceType: SOURCE_TYPE_BY_EXT[ext],
        fileName: file.originalname,
        fileSize: file.size,
        // status mặc định PENDING, sourceType mặc định PDF — schema lo
      } as any,
    });

    try {
      await withTimeout(
        this.queue.add('ingest-document', {
          documentId: doc.id,
          // ⭐ Worker chạy ngoài request → không có TenantContext.
          // tenantId PHẢI đi theo payload, không có cách nào lấy lại được.
          tenantId: doc.tenantId,
          filePath: file.path,
        }),
        ENQUEUE_TIMEOUT_MS,
        'Thêm job ingest',
      );
    } catch (err) {
      // Hàng đợi hỏng → dọn sạch để khách upload lại, đừng để lại tài liệu
      // PENDING mãi mãi không ai xử lý.
      this.log.error(
        `Không đưa được tài liệu ${doc.id} vào hàng đợi: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.prisma.document
        .delete({ where: { id: doc.id } })
        .catch(() => {});
      await unlink(file.path).catch(() => {});
      throw new ServiceUnavailableException(
        'Document processing is unavailable right now, please try again later',
      );
    }

    return doc; // client poll status để biết khi nào xong
  }
  findAll() {
    return this.prisma.document.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    // findFirst chứ không phải findUnique: extension nhét thêm tenantId vào where,
    // findUnique đòi where phải đúng khoá unique nên dễ lỗi kiểu (bẫy số 4 trong docs).
    const doc = await this.prisma.document.findFirst({ where: { id } });

    // Không tìm thấy = "không tồn tại", KHÔNG phải "cấm truy cập".
    // Trả 403 là tự tiết lộ id đó có thật ở tenant khác.
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
  async remove(id: string) {
    await this.findOne(id); // chặn trước → 404 sạch sẽ thay vì lỗi Prisma
    return this.prisma.document.delete({ where: { id } });
  }
}
