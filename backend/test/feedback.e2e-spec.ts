import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { PRISMA, type ExtendedPrismaClient } from '../src/prisma/prisma';
import { REDIS } from '../src/common/redis/redis.module';

/**
 * 👍/👎 trên câu trả lời của bot.
 *
 * /public/feedback là endpoint GHI và CÔNG KHAI — publicKey ai cũng đọc được
 * trong mã nguồn trang khách hàng. Phần lớn file này canh đúng chuyện đó: ai
 * được phép chấm cái gì.
 *
 * Chạy OFFLINE: xoá EMBEDDING_API_KEY/LLM_API_KEY sau app.init().
 */
describe('Feedback 👍/👎 (e2e)', () => {
  let app: INestApplication;
  let http: any;
  let prisma: ExtendedPrismaClient;
  let redis: Redis;

  const stamp = Date.now();
  const A = { tenantId: '', publicKey: '', token: '' };
  const B = { tenantId: '', publicKey: '' };

  const register = async (
    box: { tenantId: string; publicKey: string; token?: string },
    name: string,
  ) => {
    const res = await request(http)
      .post('/api/auth/register')
      .send({
        companyName: name,
        email: `${name.toLowerCase()}-fb-${stamp}@test.local`,
        password: 'password123',
      })
      .expect(201);
    box.tenantId = res.body.tenant.id;
    box.publicKey = res.body.tenant.publicKey;
    if ('token' in box) box.token = res.body.accessToken;
  };

  /** Chat một lượt, trả về { conversationId, messageId } của câu bot vừa đáp. */
  const ask = async (publicKey: string, visitorId: string) => {
    const res = await request(http)
      .post('/public/chat')
      .send({ publicKey, message: 'chinh sach hoan tien', visitorId })
      .expect(200);
    return res.body as { conversationId: string; messageId: string };
  };

  const vote = (body: Record<string, unknown>) =>
    request(http).post('/public/feedback').send(body);

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

    delete process.env.EMBEDDING_API_KEY;
    delete process.env.LLM_API_KEY;

    http = app.getHttpServer();
    prisma = app.get(PRISMA);
    redis = app.get(REDIS);

    await register(A, 'Alpha');
    await register(B, 'Beta');
  });

  afterAll(async () => {
    const keys = await redis.keys('rl:*');
    if (keys.length) await redis.del(...keys);
    await prisma.tenant.deleteMany({
      where: { id: { in: [A.tenantId, B.tenantId] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  // ───────────────── Đường hạnh phúc ─────────────────

  it('⭐ /public/chat trả về messageId — widget cần nó để chấm', async () => {
    const { conversationId, messageId } = await ask(A.publicKey, `v1-${stamp}`);
    expect(conversationId).toBeTruthy();
    expect(messageId).toBeTruthy();

    // Đúng là Message của BOT, không phải câu hỏi của khách.
    const row = await prisma.message.findFirst({ where: { id: messageId } });
    expect(row?.role).toBe('ASSISTANT');
  }, 30_000);

  it('chấm 👍 rồi đổi 👎 rồi rút lại — trạng thái cuối luôn đúng', async () => {
    const visitorId = `v2-${stamp}`;
    const { messageId } = await ask(A.publicKey, visitorId);

    const up = await vote({
      publicKey: A.publicKey,
      messageId,
      vote: 'UP',
      visitorId,
    }).expect(200);
    expect(up.body.feedback).toBe('UP');

    await vote({
      publicKey: A.publicKey,
      messageId,
      vote: 'DOWN',
      visitorId,
    }).expect(200);

    let row = await prisma.message.findFirst({ where: { id: messageId } });
    expect(row?.feedback).toBe('DOWN');
    expect(row?.feedbackAt).toBeTruthy();

    const none = await vote({
      publicKey: A.publicKey,
      messageId,
      vote: 'NONE',
      visitorId,
    }).expect(200);
    expect(none.body.feedback).toBeNull();

    row = await prisma.message.findFirst({ where: { id: messageId } });
    expect(row?.feedback).toBeNull();
    // Mốc thời gian cũng phải xoá — giữ lại chỉ làm dữ liệu khó đọc.
    expect(row?.feedbackAt).toBeNull();
  }, 30_000);

  it('gửi lại đúng một giá trị hai lần không đảo ngược gì (idempotent)', async () => {
    const visitorId = `v3-${stamp}`;
    const { messageId } = await ask(A.publicKey, visitorId);
    const body = { publicKey: A.publicKey, messageId, vote: 'UP', visitorId };

    await vote(body).expect(200);
    const second = await vote(body).expect(200);
    expect(second.body.feedback).toBe('UP');
  }, 30_000);

  // ───────────────── Ai được chấm cái gì ─────────────────

  it('⭐ tenant B KHÔNG chấm được message của tenant A', async () => {
    const visitorId = `v4-${stamp}`;
    const { messageId } = await ask(A.publicKey, visitorId);

    // B cầm publicKey của mình + messageId của A → phải là 404, và tuyệt đối
    // không được nói "id có tồn tại nhưng bạn không có quyền".
    await vote({
      publicKey: B.publicKey,
      messageId,
      vote: 'DOWN',
      visitorId,
    }).expect(404);

    const row = await prisma.message.findFirst({ where: { id: messageId } });
    expect(row?.feedback).toBeNull();
  }, 30_000);

  it('⭐ đúng tenant nhưng SAI visitorId → 403, không chấm hộ được', async () => {
    const owner = `v5-${stamp}`;
    const { messageId } = await ask(A.publicKey, owner);

    await vote({
      publicKey: A.publicKey,
      messageId,
      vote: 'DOWN',
      visitorId: `ke-la-mat-${stamp}`,
    }).expect(403);

    const row = await prisma.message.findFirst({ where: { id: messageId } });
    expect(row?.feedback).toBeNull();
  }, 30_000);

  it('không chấm được câu hỏi của chính khách (role USER) → 400', async () => {
    const visitorId = `v6-${stamp}`;
    const { conversationId } = await ask(A.publicKey, visitorId);

    const userMsg = await prisma.message.findFirst({
      where: { conversationId, role: 'USER' },
      select: { id: true },
    });

    await vote({
      publicKey: A.publicKey,
      messageId: userMsg!.id,
      vote: 'UP',
      visitorId,
    }).expect(400);
  }, 30_000);

  it('publicKey sai → 401; messageId không phải UUID → 400', async () => {
    await vote({
      publicKey: 'pk_khong_ton_tai',
      messageId: '00000000-0000-4000-8000-000000000000',
      vote: 'UP',
    }).expect(401);

    await vote({
      publicKey: A.publicKey,
      messageId: 'khong-phai-uuid',
      vote: 'UP',
    }).expect(400);

    await vote({
      publicKey: A.publicKey,
      messageId: '00000000-0000-4000-8000-000000000000',
      vote: 'MAYBE',
    }).expect(400);
  }, 30_000);

  // ───────────────── Dashboard đọc lại được ─────────────────

  it('⭐ dashboard thấy đúng đánh giá, và lọc được hội thoại bị chê', async () => {
    const visitorId = `v7-${stamp}`;
    const { conversationId, messageId } = await ask(A.publicKey, visitorId);
    await vote({
      publicKey: A.publicKey,
      messageId,
      vote: 'DOWN',
      visitorId,
    }).expect(200);

    const detail = await request(http)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);

    const rated = detail.body.messages.find(
      (m: { id: string }) => m.id === messageId,
    );
    expect(rated.feedback).toBe('DOWN');

    // Bộ lọc phải tìm ra hội thoại này...
    const filtered = await request(http)
      .get('/api/conversations?feedback=down')
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);

    const hit = filtered.body.items.find(
      (c: { id: string }) => c.id === conversationId,
    );
    expect(hit).toBeDefined();
    expect(hit.dislikedCount).toBeGreaterThanOrEqual(1);

    // ...và mọi hội thoại trong kết quả đều phải có ít nhất một câu bị chê.
    for (const c of filtered.body.items) {
      expect(c.dislikedCount).toBeGreaterThan(0);
    }
  }, 30_000);

  it('hội thoại chưa ai chê KHÔNG lọt vào bộ lọc', async () => {
    const visitorId = `v8-${stamp}`;
    const { conversationId } = await ask(A.publicKey, visitorId);

    const filtered = await request(http)
      .get('/api/conversations?feedback=down')
      .set('Authorization', `Bearer ${A.token}`)
      .expect(200);

    expect(
      filtered.body.items.some((c: { id: string }) => c.id === conversationId),
    ).toBe(false);
  }, 30_000);

  it('⭐ feedback dùng hạn mức RIÊNG, không ăn vào hạn mức chat', async () => {
    const visitorId = `v9-${stamp}`;
    const { messageId } = await ask(A.publicKey, visitorId);

    // Bấm 👍/👎 vài lần rồi vẫn phải hỏi tiếp được — nếu hai endpoint dùng
    // chung bộ đếm thì khách chấm điểm xong là hết lượt chat, rất vô lý.
    for (let i = 0; i < 6; i++) {
      await vote({
        publicKey: A.publicKey,
        messageId,
        vote: i % 2 ? 'UP' : 'DOWN',
        visitorId,
      }).expect(200);
    }

    await request(http)
      .post('/public/chat')
      .send({ publicKey: A.publicKey, message: 'con hoi tiep', visitorId })
      .expect(200);

    // Hai bộ đếm nằm ở hai không gian key khác nhau.
    expect(await redis.exists(`rl:fb:t:${A.tenantId}`)).toBe(1);
    expect(await redis.exists(`rl:chat:t:${A.tenantId}`)).toBe(1);
  }, 60_000);
});
