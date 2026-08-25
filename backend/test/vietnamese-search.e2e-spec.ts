import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PRISMA, type ExtendedPrismaClient } from '../src/prisma/prisma';
import { TenantContext } from '../src/common/tenant/tenant.context';
import { RetrieverService } from '../src/rag/retriever.service';
import { EmbeddingService } from '../src/ingest/embedding.service';

/**
 * Tìm kiếm từ khoá KHÔNG PHÂN BIỆT DẤU.
 *
 * Phải là e2e: thứ đang kiểm là text search configuration `vietnamese` trong
 * Postgres (simple + unaccent) và cột tsv generated dùng nó. Không có cách nào
 * kiểm bằng unit test — logic nằm trong DB, không nằm trong TypeScript.
 *
 * Chạy OFFLINE: xoá EMBEDDING_API_KEY sau app.init() nên EmbeddingService rơi
 * về vector giả tất định. Nhờ vậy nhánh vector KHÔNG thể là thứ tìm ra kết
 * quả — chunk nào lọt vào thì chắc chắn do nhánh từ khoá.
 */
describe('Tìm kiếm tiếng Việt không dấu (e2e)', () => {
  let app: INestApplication;
  let prisma: ExtendedPrismaClient;
  let retriever: RetrieverService;
  let embeddings: EmbeddingService;

  const stamp = Date.now();
  const T = { tenantId: '', docId: '' };

  /// Tài liệu viết CÓ DẤU, như khách hàng thật sẽ upload.
  const NOI_DUNG = [
    'Chính sách hoàn tiền: khách được hoàn tiền trong vòng ba mươi ngày.',
    'Phí vận chuyển nội thành là hai lăm nghìn đồng cho mỗi đơn hàng.',
    'Tra cứu đơn theo mã, ví dụ ACM-2024-3391, tại trang Đơn hàng của tôi.',
  ];

  const seed = async (content: string, i: number) => {
    const [vector] = await embeddings.embedBatch(
      [content],
      'RETRIEVAL_DOCUMENT',
    );
    await prisma.$executeRaw`
      INSERT INTO "Chunk"
        ("id","tenantId","documentId","chunkIndex","content","tokenCount","embedding")
      VALUES (gen_random_uuid(), ${T.tenantId}, ${T.docId}, ${i},
              ${content}, 30, ${JSON.stringify(vector)}::vector)
    `;
  };

  /** Truy hồi rồi trả về nội dung các chunk mà NHÁNH TỪ KHOÁ tìm ra. */
  const keywordHits = async (question: string) => {
    const chunks = await TenantContext.run({ tenantId: T.tenantId }, () =>
      retriever.retrieve(question, 10),
    );
    return chunks.filter((c) => c.keywordRank != null).map((c) => c.content);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    delete process.env.EMBEDDING_API_KEY;
    delete process.env.LLM_API_KEY;

    prisma = app.get(PRISMA);
    retriever = app.get(RetrieverService);
    embeddings = app.get(EmbeddingService);

    const tenant = await prisma.tenant.create({
      data: {
        name: 'VnSearch',
        slug: `vnsearch-${stamp}`,
        publicKey: `pk_vn_${stamp}`,
      },
    });
    T.tenantId = tenant.id;

    const doc = await prisma.document.create({
      data: {
        tenantId: T.tenantId,
        title: 'FAQ',
        sourceType: 'TXT',
        status: 'READY',
        chunkCount: NOI_DUNG.length,
      } as never,
    });
    T.docId = doc.id;

    for (const [i, content] of NOI_DUNG.entries()) await seed(content, i);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: T.tenantId } });
    await app.close();
    await prisma.$disconnect();
  });

  it('⭐ gõ KHÔNG DẤU vẫn tìm ra tài liệu CÓ DẤU', async () => {
    // Đây là cả lý do tồn tại của tính năng: người Việt chat thường bỏ dấu.
    const hits = await keywordHits('hoan tien');
    expect(hits.join(' ')).toContain('hoàn tiền');
  }, 30_000);

  it('gõ CÓ DẤU vẫn tìm ra bình thường (không làm hỏng đường cũ)', async () => {
    const hits = await keywordHits('hoàn tiền');
    expect(hits.join(' ')).toContain('hoàn tiền');
  }, 30_000);

  it('⭐ chữ đ không dấu cũng khớp — NFD không tách được chữ này', async () => {
    const hits = await keywordHits('don hang');
    expect(hits.join(' ')).toContain('đơn hàng');
  }, 30_000);

  it('chữ hai dấu (vận chuyển) khớp khi gõ trơn', async () => {
    const hits = await keywordHits('phi van chuyen');
    expect(hits.join(' ')).toContain('vận chuyển');
  }, 30_000);

  it('mã đơn vẫn khớp chính xác — thứ vector không làm được', async () => {
    const hits = await keywordHits('ACM-2024-3391');
    expect(hits.join(' ')).toContain('ACM-2024-3391');
  }, 30_000);

  it('câu hỏi toàn hư từ không dấu → nhánh từ khoá im lặng', async () => {
    // "co khong" đều là hư từ; nếu lọt qua thì chúng khớp gần như mọi chunk
    // và làm nhiễu xếp hạng.
    expect(await keywordHits('co khong')).toEqual([]);
  }, 30_000);
});
