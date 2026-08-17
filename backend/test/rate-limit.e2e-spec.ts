import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { PRISMA, type ExtendedPrismaClient } from '../src/prisma/prisma';
import { REDIS } from '../src/common/redis/redis.module';
import {
  RateLimitService,
  type Rule,
} from '../src/common/rate-limit/rate-limit.service';
import { PLAN_LIMITS } from '../src/common/rate-limit/plan-limits';

/**
 * Rate limit + quota cho /public/chat.
 *
 * Là e2e chứ không phải unit: thứ đáng kiểm nhất — script Lua và việc guard
 * có thật sự chặn trước khi tốn tiền LLM — chỉ đúng khi chạy trên Redis và
 * Postgres thật. Mock đi thì bài test chỉ kiểm chính nó.
 *
 * Chạy OFFLINE: xoá EMBEDDING_API_KEY/LLM_API_KEY sau app.init() nên không
 * gọi mạng ra ngoài (giống rag-isolation.e2e-spec.ts).
 */
describe('Rate limit & quota (e2e)', () => {
  let app: INestApplication;
  let http: any;
  let prisma: ExtendedPrismaClient;
  let redis: Redis;
  let rateLimit: RateLimitService;

  const stamp = Date.now();
  const T = { tenantId: '', publicKey: '' };
  const keysToClean: string[] = []; // key Redis cần dọn

  const rule = (name: string, limit: number, windowMs = 1000): Rule => {
    const key = `test:rl:${stamp}:${name}`;
    if (!keysToClean.includes(key)) keysToClean.push(key);
    return { key, windowMs, limit, label: name };
  };

  /** Gửi một tin nhắn chat. visitorId khác nhau = coi như khách khác nhau. */
  const chat = (visitorId: string, message = 'xin chao') =>
    request(http)
      .post('/public/chat')
      .send({ publicKey: T.publicKey, message, visitorId });

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
    rateLimit = app.get(RateLimitService);

    const res = await request(http)
      .post('/api/auth/register')
      .send({
        companyName: 'RateLimitCo',
        email: `ratelimit-${stamp}@test.local`,
        password: 'password123',
      })
      .expect(201);

    T.tenantId = res.body.tenant.id;
    T.publicKey = res.body.tenant.publicKey;
  });

  afterAll(async () => {
    if (keysToClean.length) await redis.del(...keysToClean);
    await redis.del(`rl:t:${T.tenantId}`);
    await prisma.tenant.deleteMany({ where: { id: T.tenantId } });
    await app.close();
    await prisma.$disconnect();
  });

  /** Xoá dấu vết rate limit của tenant này giữa các bài test. */
  const reset = async () => {
    const keys = await redis.keys(`rl:*${T.tenantId}*`);
    if (keys.length) await redis.del(...keys);
    // Trần theo IP dùng chung cho cả file → cũng phải dọn.
    const ipKeys = await redis.keys('rl:ip:*');
    if (ipKeys.length) await redis.del(...ipKeys);
  };

  // ───────────────── Tầng thuật toán: script Lua ─────────────────

  it('cho qua tới đúng hạn mức rồi mới chặn', async () => {
    const r = [rule('basic', 3)];
    for (let i = 0; i < 3; i++) {
      expect(await rateLimit.check(r)).toEqual({ allowed: true });
    }
    const v = await rateLimit.check(r);
    expect(v.allowed).toBe(false);
    if (!v.allowed) {
      expect(v.label).toBe('basic');
      expect(v.retryAfterSec).toBeGreaterThanOrEqual(1);
    }
  });

  it('cửa sổ trượt: hết cửa sổ thì được gửi lại', async () => {
    const r = [rule('slide', 2, 300)];
    await rateLimit.check(r);
    await rateLimit.check(r);
    expect((await rateLimit.check(r)).allowed).toBe(false);

    await new Promise((res) => setTimeout(res, 350));
    expect(await rateLimit.check(r)).toEqual({ allowed: true });
  });

  it('⭐ request bị chặn KHÔNG ăn suất của luật đứng trước', async () => {
    // Luật 1 rộng (10), luật 2 chật (1). Request thứ hai bị luật 2 chặn.
    // Nếu Lua ghi nhận từng luật thay vì kiểm hết rồi mới ghi, luật rộng đã
    // bị trừ một suất cho request chưa từng được phục vụ.
    const wide = rule('wide', 10);
    const chatRule = rule('chat', 1);

    expect((await rateLimit.check([wide, chatRule])).allowed).toBe(true);
    expect((await rateLimit.check([wide, chatRule])).allowed).toBe(false);

    expect(await redis.zcard(wide.key)).toBe(1);
  });

  it('hai request cùng mili giây vẫn tính thành hai', async () => {
    // member phải duy nhất, nếu không ZADD ghi đè và cửa sổ đếm thiếu.
    const r = [rule('song-song', 5, 5000)];
    await Promise.all([
      rateLimit.check(r),
      rateLimit.check(r),
      rateLimit.check(r),
    ]);
    expect(await redis.zcard(r[0].key)).toBe(3);
  });

  it('⭐ Redis chết → fail-open, không chặn khách', async () => {
    const dead = new Redis('redis://127.0.0.1:1', {
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    dead.on('error', () => {}); // ioredis ném unhandled error nếu không nghe
    const s = new RateLimitService(dead);

    expect(await s.check([rule('ignored', 1)])).toEqual({ allowed: true });
    dead.disconnect();
  });

  // ───────────────── Tầng HTTP: /public/chat ─────────────────

  it('⭐ một khách gửi dồn dập → 429 kèm Retry-After và câu tiếng Việt', async () => {
    await reset();
    const visitor = `v-burst-${stamp}`;
    const limit = Number(process.env.RATE_LIMIT_VISITOR_PER_MIN ?? 8);

    let blocked: request.Response | undefined;
    for (let i = 0; i < limit + 2; i++) {
      const res = await chat(visitor);
      if (res.status === 429) {
        blocked = res;
        break;
      }
      expect(res.status).toBe(200);
    }

    expect(blocked).toBeDefined();
    expect(blocked!.body.code).toBe('RATE_LIMITED');
    expect(blocked!.body.message).toContain('thử lại sau');
    expect(blocked!.body.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(blocked!.headers['retry-after']).toBeDefined();
  }, 60_000);

  it('khách khác không bị vạ lây bởi trần của khách đang bị chặn', async () => {
    await reset();
    const spammer = `v-spam-${stamp}`;
    const limit = Number(process.env.RATE_LIMIT_VISITOR_PER_MIN ?? 8);

    for (let i = 0; i < limit + 1; i++) await chat(spammer);
    // Khách kia phải vẫn gửi được — trần visitor tính riêng từng người.
    // (Trần IP rộng hơn nên chưa chạm ở đây.)
    await expect(
      chat(`v-hien-lanh-${stamp}`).expect(200),
    ).resolves.toBeTruthy();
  }, 60_000);

  it('publicKey sai → 401 trước, không tốn lượt rate limit', async () => {
    await reset();
    await request(http)
      .post('/public/chat')
      .send({ publicKey: 'pk_khong_ton_tai', message: 'hi', visitorId: 'v-x' })
      .expect(401);

    // Guard rate limit đứng sau PublicWidgetGuard nên chưa hề chạy.
    expect(await redis.exists(`rl:t:${T.tenantId}`)).toBe(0);
  });

  // ───────────────── Quota tháng ─────────────────

  it('⭐ hết quota tháng → 429 QUOTA_EXCEEDED kèm resetAt', async () => {
    await reset();

    // Nhét đủ UsageEvent để chạm trần gói FREE. Ghi thẳng vào DB thay vì chat
    // thật hàng trăm lần: quota đếm bảng này, đó là thứ cần kiểm.
    const n = PLAN_LIMITS.FREE.aiMessagesPerMonth;
    await prisma.usageEvent.createMany({
      data: Array.from({ length: n }, () => ({
        tenantId: T.tenantId,
        type: 'AI_MESSAGE' as const,
      })),
    });

    const res = await chat(`v-quota-${stamp}`).expect(429);
    expect(res.body.code).toBe('QUOTA_EXCEEDED');
    expect(res.body.used).toBeGreaterThanOrEqual(n);
    expect(res.body.limit).toBe(n);
    expect(new Date(res.body.resetAt).getUTCDate()).toBe(1);
  }, 60_000);

  it('usage của tenant KHÁC không tính vào quota của mình', async () => {
    // Guard đếm qua Prisma extension (tự thêm WHERE tenantId) và cũng truyền
    // tenantId tường minh. Bài này canh cả hai lớp đó.
    const other = await request(http)
      .post('/api/auth/register')
      .send({
        companyName: 'HangXom',
        email: `hangxom-${stamp}@test.local`,
        password: 'password123',
      })
      .expect(201);

    try {
      await reset();
      // Tenant T đã có đủ quota từ bài trước; hàng xóm phải vẫn chat được.
      await request(http)
        .post('/public/chat')
        .send({
          publicKey: other.body.tenant.publicKey,
          message: 'xin chao',
          visitorId: `v-hangxom-${stamp}`,
        })
        .expect(200);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: other.body.tenant.id } });
    }
  }, 60_000);
});
