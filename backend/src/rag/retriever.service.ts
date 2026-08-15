import { Inject, Injectable } from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant.context';
import { EmbeddingService } from '../ingest/embedding.service';
import { type ExtendedPrismaClient, PRISMA } from '../prisma/prisma';
export type RetrievedChunk = {
  id: string;
  content: string;
  documentId: string;
  documentTitle: string;
  /// Cosine distance: 0 = trùng khớp hoàn toàn, 2 = đối lập.
  /// Càng nhỏ càng liên quan.
  distance: number;
};
@Injectable()
export class RetrieverService {
  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    private readonly embeddings: EmbeddingService,
  ) {}

  async retrieve(question: string, topK?: number): Promise<RetrievedChunk[]> {
    const tenantId = TenantContext.requireTenantId();
    // ⚠️ RETRIEVAL_QUERY, KHÔNG phải RETRIEVAL_DOCUMENT.
    // Gemini sinh vector khác nhau cho hai vai trò này. Dùng nhầm vẫn chạy,
    // chỉ là kết quả kém đi — lại một lỗi im lặng.
    const [vector] = await this.embeddings.embedBatch(
      [question],
      'RETRIEVAL_QUERY',
    );
    const limit = topK ?? Number(process.env.RAG_TOP_K ?? 5);
    return this.prisma.$queryRaw<RetrievedChunk[]>`
      SELECT c.id,
             c.content,
             c."documentId",
             d.title AS "documentTitle",
             (c.embedding <=> ${JSON.stringify(vector)}::vector) AS distance
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId"
      WHERE c."tenantId" = ${tenantId}    -- ⭐ KHÔNG BAO GIỜ được thiếu
        AND d."tenantId" = ${tenantId}    -- thừa về logic, giữ làm lớp hai
        AND c.embedding IS NOT NULL       -- chunk đang ingest dở
      ORDER BY distance
      LIMIT ${limit}
    `;
  }
}
