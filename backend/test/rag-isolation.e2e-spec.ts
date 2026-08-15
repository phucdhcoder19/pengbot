import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PRISMA, type ExtendedPrismaClient } from '../src/prisma/prisma';
import { TenantContext } from '../src/common/tenant/tenant.context';
import { RetrieverService } from '../src/rag/retriever.service';
import { EmbeddingService } from '../src/ingest/embedding.service';

/**
 * Bài test cho tầng RAG.
 *
 * Bài tenant-isolation.e2e-spec.ts chỉ phủ /api/* — nơi Prisma extension tự
 * chèn WHERE tenantId. Tầng RAG dùng $queryRaw, KHÔNG đi qua extension, nên
 * dòng `WHERE c."tenantId"` trong retriever.service.ts là thứ duy nhất ngăn
 * công ty A đọc tài liệu công ty B. File này canh đúng dòng đó.
 *
 * Chạy hoàn toàn OFFLINE: beforeAll xoá EMBEDDING_API_KEY và LLM_API_KEY nên
 * EmbeddingService rơi về vector giả tất định, và mọi chunk đều xa hơn ngưỡng
 * RAG_MAX_DISTANCE → AnswererService trả "không có thông tin" mà không gọi LLM.
 * Cô lập tenant nằm ở mệnh đề WHERE, không liên quan chất lượng vector — nên
 * vector giả vẫn kiểm được đúng thứ cần kiểm.
 */
describe('Cô lập tenant ở tầng RAG (e2e)', () => {
  let app: INestApplication;
  let http: any;
  let prisma: ExtendedPrismaClient;
  let retriever: RetrieverService;
  let embeddings: EmbeddingService;

  const stamp = Date.now();

  const A = { token: '', tenantId: '', publicKey: '', docId: '' };
  const B = { token: '', tenantId: '', publicKey: '', docId: '' };

  const NOI_DUNG_A =
    'Chinh sach hoan tien cua ACME. Hoan tien trong ba muoi ngay. Phi xu ly la khong dong.';
  const NOI_DUNG_B =
    'Chinh sach hoan tien cua GLOBEX. Hoan tien trong bay ngay. Phi xu ly la nam phan tram.';

  /** Đăng ký công ty rồi nhét thẳng 1 Document + 1 Chunk có vector vào DB. */
  const seed = async (box: typeof A, name: string, noiDung: string) => {
    const res = await request(http)
      .post('/api/auth/register')
      .send({
        companyName: name,
        email: `${name.toLowerCase()}-rag-${stamp}@test.local`,
        password: 'password123',
      })
      .expect(201);

    box.token = res.body.accessToken;
    box.tenantId = res.body.tenant.id;
    box.publicKey = res.body.tenant.publicKey;

    // Không upload qua HTTP: bài test này kiểm RAG, không kiểm ingest.
    // Nhét thẳng vào DB nhanh hơn và tất định hơn là chờ worker BullMQ.
    const doc = await prisma.document.create({
      data: {
        tenantId: box.tenantId, // không có TenantContext ở đây → phải tự truyền
        title: `Chinh sach ${name}`,
        sourceType: 'TXT',
        status: 'READY',
        chunkCount: 1,
      } as any,
    });
    box.docId = doc.id;

    const [vector] = await embeddings.embedBatch([noiDung], 'RETRIEVAL_DOCUMENT');

    await prisma.$executeRaw`
      INSERT INTO "Chunk"
        ("id","tenantId","documentId","chunkIndex","content","tokenCount","embedding")
      VALUES (gen_random_uuid(), ${box.tenantId}, ${doc.id}, 0,
              ${noiDung}, 30, ${JSON.stringify(vector)}::vector)
    `;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Xoá SAU app.init() — ConfigModule nạp .env vào process.env lúc khởi tạo,
    // xoá trước sẽ bị nó ghi đè lại.
    delete process.env.EMBEDDING_API_KEY;
    delete process.env.LLM_API_KEY;

    http = app.getHttpServer();
    prisma = app.get(PRISMA);
    retriever = app.get(RetrieverService);
    embeddings = app.get(EmbeddingService);

    await seed(A, 'Acme', NOI_DUNG_A);
    await seed(B, 'Globex', NOI_DUNG_B);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [A.tenantId, B.tenantId] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  // ───────────── Tầng retriever: đúng chỗ có $queryRaw ─────────────

  it('A truy hồi → chỉ ra chunk của A', async () => {
    const chunks = await TenantContext.run({ tenantId: A.tenantId }, () =>
      retriever.retrieve('chinh sach hoan tien va phi xu ly'),
    );

    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.documentId).toBe(A.docId);
    }
  });

  it('⭐ nội dung của B KHÔNG BAO GIỜ lọt vào kết quả của A', async () => {
    const chunks = await TenantContext.run({ tenantId: A.tenantId }, () =>
      retriever.retrieve('phi xu ly hoan tien la bao nhieu'),
    );

    const gop = chunks.map((c) => c.content).join(' ');
    expect(gop).toContain('ACME');
    expect(gop).not.toContain('GLOBEX');
    expect(gop).not.toContain('nam phan tram'); // số liệu riêng của B
  });

  it('B truy hồi → chỉ ra chunk của B', async () => {
    const chunks = await TenantContext.run({ tenantId: B.tenantId }, () =>
      retriever.retrieve('phi xu ly hoan tien la bao nhieu'),
    );

    const gop = chunks.map((c) => c.content).join(' ');
    expect(gop).toContain('GLOBEX');
    expect(gop).not.toContain('ACME');
  });

  it('không có TenantContext → retriever ném lỗi thay vì quét cả bảng', async () => {
    // requireTenantId phải nổ. Nếu ở đây trả về mảng thì nghĩa là ai đó đã
    // đổi sang getTenantId() và câu SELECT đang chạy KHÔNG lọc tenant.
    await expect(retriever.retrieve('bat ky')).rejects.toThrow();
  });

  // ───────────── Tầng HTTP: /public/chat ─────────────

  it('publicKey sai → 401', () =>
    request(http)
      .post('/public/chat')
      .send({ publicKey: 'pk_khong_ton_tai', message: 'hoan tien the nao' })
      .expect(401));

  it('thiếu publicKey → 401', () =>
    request(http)
      .post('/public/chat')
      .send({ publicKey: '', message: 'hoan tien the nao' })
      .expect(401));

  it('publicKey hợp lệ → 200 và cấp conversationId', async () => {
    const res = await request(http)
      .post('/public/chat')
      .send({ publicKey: A.publicKey, message: 'hoan tien the nao' })
      .expect(200);

    expect(res.body.conversationId).toBeTruthy();
    expect(typeof res.body.answer).toBe('string');
    expect(Array.isArray(res.body.citations)).toBe(true);
  });

  it('⭐ B dùng conversationId của A → được cấp phiên MỚI, không đọc được phiên cũ', async () => {
    const cuaA = await request(http)
      .post('/public/chat')
      .send({ publicKey: A.publicKey, message: 'cau hoi cua A' })
      .expect(200);

    const cuaB = await request(http)
      .post('/public/chat')
      .send({
        publicKey: B.publicKey,
        message: 'cau hoi cua B',
        conversationId: cuaA.body.conversationId,
      })
      .expect(200);

    expect(cuaB.body.conversationId).not.toBe(cuaA.body.conversationId);
  });

  it('Message luôn thuộc đúng tenant của Conversation', async () => {
    const lech = await prisma.$queryRaw<{ lech: number }[]>`
      SELECT count(*)::int AS lech
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE m."tenantId" IS DISTINCT FROM c."tenantId"
    `;
    expect(lech[0].lech).toBe(0);
  });

  // ───────────── allowedDomains ─────────────

  it('cấu hình allowedDomains → Origin lạ bị 403, Origin đúng qua được', async () => {
    await prisma.tenant.update({
      where: { id: A.tenantId },
      data: { allowedDomains: ['acme.com'] },
    });

    await request(http)
      .post('/public/chat')
      .set('Origin', 'https://ke-trom.com')
      .send({ publicKey: A.publicKey, message: 'hoan tien' })
      .expect(403);

    await request(http)
      .post('/public/chat')
      .set('Origin', 'https://shop.acme.com') // subdomain phải được chấp nhận
      .send({ publicKey: A.publicKey, message: 'hoan tien' })
      .expect(200);

    // Trả về trạng thái ban đầu để các test khác không bị ảnh hưởng
    await prisma.tenant.update({
      where: { id: A.tenantId },
      data: { allowedDomains: [] },
    });
  });
});
