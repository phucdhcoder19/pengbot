import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { type ExtendedPrismaClient, PRISMA } from '../prisma/prisma';
import { EmbeddingService } from './embedding.service';
import { TenantContext } from '../common/tenant/tenant.context';
import { extractText } from './extract-text';
import { chunkText, estimateTokens } from './chunker';
import { unlink } from 'node:fs/promises';

export const INGEST_QUEUE = 'ingest';
/// Payload của job. tenantId BẮT BUỘC có mặt ở đây — worker chạy ngoài request
/// nên không có TenantContext, không có cách nào lấy lại được nếu thiếu.
export type IngestJob = {
  documentId: string;
  tenantId: string;
  filePath: string;
};
/// Gemini batchEmbedContents nhận tối đa 100 phần tử mỗi lần gọi.
const EMBED_BATCH = 100;

@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    private readonly embeddings: EmbeddingService,
  ) {
    super();
  }
  private readonly log = new Logger(IngestProcessor.name);

  async process(job: Job<IngestJob>) {
    const { documentId, tenantId, filePath } = job.data;

    // ⭐ CẠM BẪY 1 — worker chạy NGOÀI request nên AsyncLocalStorage rỗng.
    // Thiếu dòng này thì Prisma extension không lọc gì cả: mọi truy vấn
    // trong ingest() sẽ chạm được dữ liệu của MỌI công ty.
    return TenantContext.run({ tenantId }, () =>
      this.ingest(job, documentId, filePath),
    );
  }

  private async ingest(
    job: Job<IngestJob>,
    documentId: string,
    filePath: string,
  ) {
    const tenantId = TenantContext.requireTenantId();

    // Tài liệu có thể đã bị xoá trong lúc job nằm chờ trong hàng đợi (khách bấm
    // xoá, hoặc cả tenant bị xoá). Khi đó không có gì để làm — kết thúc êm thay
    // vì để prisma.update ném "No record was found" rồi retry 3 lần vô ích.
    const exists = await this.prisma.document.findFirst({
      where: { id: documentId },
      select: { id: true },
    });
    if (!exists) {
      this.log.warn(`Bỏ qua job: tài liệu ${documentId} không còn tồn tại`);
      await unlink(filePath).catch(() => {});
      return { skipped: true };
    }

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING', error: null },
      });
      // Job có thể chạy lại (attempts: 3). Xoá chunk của lần trước để lần này
      // không đụng ràng buộc @@unique([documentId, chunkIndex]).
      await this.prisma.chunk.deleteMany({ where: { documentId } });
      const text = await extractText(filePath);

      // 2. text → chunks
      const pieces = chunkText(text);
      if (!pieces.length) {
        throw new Error(
          'Không rút được chữ nào — file rỗng hoặc là bản scan ảnh (cần OCR)',
        );
      }

      // 3. chunks → vectors → INSERT, theo lô
      for (let i = 0; i < pieces.length; i += EMBED_BATCH) {
        const batch = pieces.slice(i, i + EMBED_BATCH);
        const vectors = await this.embeddings.embedBatch(
          batch,
          'RETRIEVAL_DOCUMENT', // đây là tài liệu, không phải câu hỏi
        );

        for (let j = 0; j < batch.length; j++) {
          // ⭐ CẠM BẪY 2 — raw SQL KHÔNG đi qua extension.
          // "tenantId" phải tự tay viết vào, không ai chèn hộ.
          await this.prisma.$executeRaw`
            INSERT INTO "Chunk"
              ("id", "tenantId", "documentId", "chunkIndex",
               "content", "tokenCount", "embedding")
            VALUES (
              gen_random_uuid(), ${tenantId}, ${documentId}, ${i + j},
              ${batch[j]}, ${estimateTokens(batch[j])},
              ${JSON.stringify(vectors[j])}::vector
            )
          `;
        }

        await job.updateProgress(
          Math.round(((i + batch.length) / pieces.length) * 100),
        );
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY', chunkCount: pieces.length, error: null },
      });

      // Chỉ xoá file khi ĐÃ thành công. Hỏng thì giữ lại để lần retry còn đọc được.
      await unlink(filePath).catch(() => {});

      this.log.log(`Ingest xong ${documentId}: ${pieces.length} chunk`);
      return { chunkCount: pieces.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(`Ingest hỏng ${documentId}: ${message}`);

      // Lưu lỗi để dashboard hiện được cho người dùng, đừng nuốt im lặng
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', error: message.slice(0, 500) },
      });

      throw err; // ném lại để BullMQ đánh dấu failed + retry theo cấu hình
    }
  }
}
