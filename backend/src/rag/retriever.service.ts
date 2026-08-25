import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant.context';
import { EmbeddingService } from '../ingest/embedding.service';
import { type ExtendedPrismaClient, PRISMA } from '../prisma/prisma';
import { fuse } from './rrf';
import { keywordQueryText } from './keyword-query';

export type RetrievedChunk = {
  id: string;
  content: string;
  documentId: string;
  documentTitle: string;
  /// Cosine distance: 0 = trùng khớp hoàn toàn, 2 = đối lập.
  /// Càng nhỏ càng liên quan. LUÔN có, kể cả chunk chỉ nhánh từ khoá tìm ra
  /// (nhánh đó cũng tính distance cho các dòng của nó).
  distance: number;
  /// Điểm RRF sau khi gộp hai nhánh. Chỉ dùng để xếp thứ tự, không có ý nghĩa
  /// tuyệt đối — đừng so với ngưỡng nào.
  score: number;
  /// Thứ hạng ở từng nhánh (đếm từ 1); null = nhánh đó không tìm ra chunk này.
  /// Dùng cho log/debug và cho chốt chặn tin cậy ở AnswererService.
  vectorRank: number | null;
  keywordRank: number | null;
};

/// Dòng thô trả về từ hai câu SELECT (chưa có score/ranks).
type Row = Omit<RetrievedChunk, 'score' | 'vectorRank' | 'keywordRank'>;

@Injectable()
export class RetrieverService {
  private readonly log = new Logger(RetrieverService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    private readonly embeddings: EmbeddingService,
  ) {}

  /**
   * Hybrid search: vector (theo nghĩa) + full-text (theo chữ) → RRF → top-k.
   *
   * Vector giỏi đồng nghĩa ("chi phí" ≈ "phí vận chuyển") nhưng mù với chuỗi
   * chính xác (mã đơn, số điện thoại, tên sản phẩm lạ). Full-text ngược lại.
   * Mỗi nhánh lấy rộng (RAG_CANDIDATES, mặc định 20) rồi gộp và cắt còn top-k.
   */
  async retrieve(question: string, topK?: number): Promise<RetrievedChunk[]> {
    const tenantId = TenantContext.requireTenantId();
    const limit = topK ?? Number(process.env.RAG_TOP_K ?? 5);
    const candidates = Math.max(
      limit,
      Number(process.env.RAG_CANDIDATES ?? 20),
    );

    // ⚠️ RETRIEVAL_QUERY, KHÔNG phải RETRIEVAL_DOCUMENT.
    // Gemini sinh vector khác nhau cho hai vai trò này. Dùng nhầm vẫn chạy,
    // chỉ là kết quả kém đi — lại một lỗi im lặng.
    const [vector] = await this.embeddings.embedBatch(
      [question],
      'RETRIEVAL_QUERY',
    );
    const vectorLiteral = JSON.stringify(vector);
    const keywords = keywordQueryText(question);

    // Hai nhánh độc lập → chạy song song.
    const [byVector, byKeyword] = await Promise.all([
      this.searchByVector(tenantId, vectorLiteral, candidates),
      keywords
        ? this.searchByKeyword(tenantId, keywords, vectorLiteral, candidates)
        : Promise.resolve([] as Row[]),
    ]);

    const fused = fuse([byVector, byKeyword], (r) => r.id).slice(0, limit);

    this.log.debug(
      `retrieve: vector=${byVector.length} keyword=${byKeyword.length} → top${limit} ` +
        fused
          .map((f) => `[v${f.ranks[0] ?? '-'} k${f.ranks[1] ?? '-'}]`)
          .join(' '),
    );

    return fused.map(({ ranks, ...rest }) => ({
      ...rest,
      vectorRank: ranks[0],
      keywordRank: ranks[1],
    }));
  }

  /** Nhánh 1 — vector: k chunk có embedding gần câu hỏi nhất. */
  private searchByVector(
    tenantId: string,
    vectorLiteral: string,
    limit: number,
  ): Promise<Row[]> {
    return this.prisma.$queryRaw<Row[]>`
      SELECT c.id,
             c.content,
             c."documentId",
             d.title AS "documentTitle",
             (c.embedding <=> ${vectorLiteral}::vector) AS distance
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId"
      WHERE c."tenantId" = ${tenantId}    -- ⭐ KHÔNG BAO GIỜ được thiếu
        AND d."tenantId" = ${tenantId}    -- thừa về logic, giữ làm lớp hai
        AND c.embedding IS NOT NULL       -- chunk đang ingest dở
      ORDER BY distance
      LIMIT ${limit}
    `;
  }

  /**
   * Nhánh 2 — từ khoá: k chunk chứa nhiều từ trong câu hỏi nhất.
   *
   * Xây tsquery NGAY TRONG SQL từ chính câu hỏi:
   *   to_tsvector('vietnamese', câu hỏi) → lexeme ĐÃ BỎ DẤU, y hệt cột tsv
   *   unnest + string_agg(' | ')       → 'đơn' | 'acm' | '-2024' | ...   (OR)
   *   to_tsquery(...)                  → tsquery
   *
   * Nối OR chứ KHÔNG dùng websearch_to_tsquery (mặc định AND): ta muốn chunk
   * chỉ trúng MỘT từ hiếm ("acm-2024-3391") vẫn được tìm ra — đó chính là
   * việc của nhánh này. quote_literal để lexeme lạ ('a/b', 'it''s') không
   * phá cú pháp tsquery. Câu hỏi đi qua tham số $n nên không có SQL injection.
   *
   * Cũng tính distance cho các dòng ở đây (chỉ vài chục dòng, rẻ) để mọi chunk
   * trả về đều có distance thật — AnswererService cần nó cho chốt chặn tin cậy.
   */
  private searchByKeyword(
    tenantId: string,
    keywords: string,
    vectorLiteral: string,
    limit: number,
  ): Promise<Row[]> {
    return this.prisma.$queryRaw<Row[]>`
      WITH q AS (
        SELECT to_tsquery('vietnamese', string_agg(quote_literal(lexeme), ' | ')) AS query
        FROM unnest(to_tsvector('vietnamese', ${keywords}))
      )
      SELECT c.id,
             c.content,
             c."documentId",
             d.title AS "documentTitle",
             (c.embedding <=> ${vectorLiteral}::vector) AS distance
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId"
      CROSS JOIN q
      WHERE c."tenantId" = ${tenantId}    -- ⭐ KHÔNG BAO GIỜ được thiếu
        AND d."tenantId" = ${tenantId}
        AND c.embedding IS NOT NULL
        AND q.query IS NOT NULL           -- câu hỏi không còn lexeme nào
        AND c.tsv @@ q.query
      ORDER BY ts_rank(c.tsv, q.query) DESC, distance
      LIMIT ${limit}
    `;
  }
}
