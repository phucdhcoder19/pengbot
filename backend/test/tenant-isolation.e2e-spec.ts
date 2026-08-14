import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PRISMA, type ExtendedPrismaClient } from '../src/prisma/prisma';

/**
 * Đây là bài test quan trọng nhất của dự án.
 * Nó trả lời đúng một câu: công ty A có cách nào chạm được dữ liệu công ty B không?
 *
 * Mỗi lần sửa Prisma extension, middleware, hay guard — chạy lại file này.
 */
describe('Cô lập tenant (e2e)', () => {
  let app: INestApplication;
  let http: any;
  let prisma: ExtendedPrismaClient;

  // Email unique TOÀN HỆ THỐNG → mỗi lần chạy test phải sinh email khác,
  // nếu không lần chạy thứ hai sẽ dính 409 Conflict.
  const stamp = Date.now();

  const A = { token: '', tenantId: '', docId: '' };
  const B = { token: '', tenantId: '', docId: '' };

  /** Đăng ký một công ty rồi tạo cho nó đúng 1 tài liệu. */
  const setup = async (box: typeof A, name: string) => {
    const res = await request(http)
      .post('/api/auth/register')
      .send({
        companyName: name,
        email: `${name.toLowerCase()}-${stamp}@test.local`,
        password: 'password123',
      })
      .expect(201);

    box.token = res.body.accessToken;
    box.tenantId = res.body.tenant.id;

    const doc = await request(http)
      .post('/api/documents')
      .set('Authorization', `Bearer ${box.token}`)
      // chú ý: body KHÔNG có tenantId — extension phải tự chèn
      .send({ title: `Tài liệu mật của ${name}` })
      .expect(201);

    box.docId = doc.body.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Phải khớp main.ts. Lệch một tuỳ chọn là đang test một app khác app thật.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    http = app.getHttpServer();
    prisma = app.get(PRISMA);

    await setup(A, 'Acme');
    await setup(B, 'Globex');
  });

  afterAll(async () => {
    // Tenant không nằm trong TENANT_MODELS, và ở đây cũng không có request context
    // → câu lệnh chạy đúng như viết. Cascade dọn document/user con.
    await prisma.tenant.deleteMany({
      where: { id: { in: [A.tenantId, B.tenantId] } },
    });
    await app.close();
    // PRISMA là provider factory thuần, Nest không tự gọi $disconnect
    // → thiếu dòng này thì Jest treo vì còn kết nối Postgres mở.
    await prisma.$disconnect();
  });

  it('tenantId được chèn tự động, dù client không gửi lên', async () => {
    const doc = await prisma.document.findFirst({ where: { id: A.docId } });
    expect(doc?.tenantId).toBe(A.tenantId);
  });

  it('không có token → 401', () =>
    request(http).get('/api/documents').expect(401));

  it('token rác → 401', () =>
    request(http)
      .get('/api/documents')
      .set('Authorization', 'Bearer khong.phai.jwt')
      .expect(401));

  it('A list documents → chỉ thấy của A', async () => {
    const res = await request(http)
      .get('/api/documents')
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(A.docId);
    expect(res.body.map((d: any) => d.id)).not.toContain(B.docId);
  });

  it('⭐ A truyền thẳng documentId của B → 404, không phải 200', () =>
    request(http)
      .get(`/api/documents/${B.docId}`)
      .set('Authorization', `Bearer ${A.token}`)
      .expect(404));

  it('đối chứng: chính chủ B đọc documentId của B → 200', () =>
    // Không có case này thì 404 ở trên có thể chỉ là do endpoint hỏng.
    request(http)
      .get(`/api/documents/${B.docId}`)
      .set('Authorization', `Bearer ${B.token}`)
      .expect(200));

  it('⭐ A xoá documentId của B → 404 và tài liệu của B vẫn còn', async () => {
    await request(http)
      .delete(`/api/documents/${B.docId}`)
      .set('Authorization', `Bearer ${A.token}`)
      .expect(404);

    const conNguyen = await prisma.document.findFirst({
      where: { id: B.docId },
    });
    expect(conNguyen).not.toBeNull();
  });

  it('xoá tenant A → dữ liệu A biến mất, dữ liệu B nguyên vẹn (cascade)', async () => {
    await prisma.tenant.delete({ where: { id: A.tenantId } });

    expect(
      await prisma.document.count({ where: { tenantId: A.tenantId } }),
    ).toBe(0);
    expect(
      await prisma.document.count({ where: { tenantId: B.tenantId } }),
    ).toBe(1);
  });
});
