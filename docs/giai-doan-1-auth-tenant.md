# Giai đoạn 1 — Auth + Cô lập tenant

> Hướng dẫn tự làm. Mỗi bước có **mục tiêu**, **code cần gõ**, và **checkpoint** để biết đã đúng chưa.
> Đây là phần khó nhất dự án. Làm chậm, đừng nhảy bước.

**Xong giai đoạn này khi:** đăng ký 2 công ty A và B, đăng nhập bằng A, và **không cách nào** lấy được dữ liệu của B — kể cả khi truyền thẳng ID của B vào URL.

---

## ✅ Quyết định đã chốt: email unique toàn hệ thống

**Vấn đề:** login chỉ có email + password. Nếu email chỉ unique theo từng tenant (`@@unique([tenantId, email])`) thì `an@gmail.com` tồn tại được ở cả công ty A lẫn B — server không biết chọn user nào.

**Đã chọn cách A:** `email String @unique`, bỏ `@@unique([tenantId, email])`.
Đánh đổi: một người chỉ thuộc một công ty. Đủ cho MVP. Sau này cần cho một người thuộc nhiều công ty thì đảo lại và thêm ô "mã công ty" vào form đăng nhập.

Đã áp dụng qua migration `20260814004500_global_unique_email`. Code dùng được:
```ts
this.prisma.user.findUnique({ where: { email: dto.email } });
```

### ⚠️ Chu trình migrate từ giờ trở đi

Index HNSW làm `migrate dev` báo drift và **đòi reset cả DB**. Luôn chạy 3 lệnh theo thứ tự:

```bash
npm run db:vector-index:drop         # 1. tắt index
npx prisma migrate dev --name <ten>  # 2. migrate
npm run db:vector-index              # 3. bật lại (tuỳ chọn — dev không cần)
```

Nếu `migrate dev` đòi xác nhận mà terminal không tương tác được: tự viết `prisma/migrations/<timestamp>_<ten>/migration.sql` rồi `npx prisma migrate deploy`.

---

## Các file sẽ tạo

```
backend/src/
├── prisma/
│   ├── prisma.ts              ① client + extension lọc tenantId
│   └── prisma.module.ts       ② provider toàn cục
├── common/tenant/
│   ├── tenant.context.ts      ③ AsyncLocalStorage
│   ├── tenant.middleware.ts   ⑤ đặt context cho mỗi request
│   ├── jwt-auth.guard.ts      ⑥ chặn route /api/* nếu chưa đăng nhập
│   └── current-user.decorator.ts
└── auth/
    ├── auth.module.ts         ④
    ├── auth.service.ts
    ├── auth.controller.ts
    └── dto/
```

---

## Bước 1 — Prisma client + extension lọc tenantId

**Mục tiêu:** mọi truy vấn Prisma tự động có `where.tenantId`, không cần lập trình viên nhớ.

### ⚠️ Cạm bẫy phải biết trước

`prismaClient.$extends(...)` **trả về một client MỚI**, không sửa client cũ. Nên cách viết quen thuộc này **không hoạt động**:

```ts
// ❌ SAI — extension bị vứt đi, không có tác dụng
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({ adapter });
    this.$extends({ ... });   // giá trị trả về không được dùng
  }
}
```

Cách đúng: tạo client bằng factory rồi cấp qua provider.

### `src/prisma/prisma.ts`

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { TenantContext } from '../common/tenant/tenant.context';

/// Các model có cột tenantId. Tenant không nằm trong đây (nó CHÍNH LÀ tenant).
const TENANT_MODELS = new Set([
  'User', 'Document', 'Chunk', 'Conversation', 'Message', 'UsageEvent',
]);

export function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = TenantContext.getTenantId();

          // Không có context (lúc register/login) hoặc model không thuộc tenant → chạy nguyên bản
          if (!tenantId || !TENANT_MODELS.has(model)) return query(args);

          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'update':
            case 'updateMany':
            case 'delete':
            case 'deleteMany':
              (args as any).where = { ...(args as any).where, tenantId };
              break;

            case 'create':
              (args as any).data = { ...(args as any).data, tenantId };
              break;

            case 'upsert':
              (args as any).where = { ...(args as any).where, tenantId };
              (args as any).create = { ...(args as any).create, tenantId };
              break;
          }

          return query(args);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
export const PRISMA = Symbol('PRISMA');
```

### `src/prisma/prisma.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { PRISMA, createPrismaClient } from './prisma';

@Global()
@Module({
  providers: [{ provide: PRISMA, useFactory: createPrismaClient }],
  exports: [PRISMA],
})
export class PrismaModule {}
```

Dùng ở service khác:
```ts
constructor(@Inject(PRISMA) private readonly prisma: ExtendedPrismaClient) {}
```

### Bốn lỗ hổng extension KHÔNG bịt được — nhớ kỹ

1. **`$queryRaw` / `$executeRaw` không đi qua extension.** Vector search giai đoạn 3 sẽ dùng raw SQL → phải tự gõ `WHERE "tenantId" = ${tenantId}`. Đây là chỗ nguy hiểm nhất dự án.
2. **Nested write** (`tenant.create({ data: { users: { create: {...} } } })`) — bản ghi con không được chèn `tenantId` tự động, nhưng Prisma tự suy ra từ quan hệ nên vẫn đúng.
3. **`createMany`** — chưa xử lý trong đoạn code trên (`data` là mảng). Tự thêm khi cần ở giai đoạn 2 (lúc insert hàng loạt Chunk).
4. **`findUnique` + `tenantId`** hoạt động nhờ tính năng *extended where unique*. Nếu TypeScript báo lỗi kiểu ở dòng này, đổi `findUnique` → `findFirst`.

---

## Bước 2 — TenantContext

**Mục tiêu:** giữ `tenantId` xuyên suốt một request mà không phải truyền tham số qua từng hàm.

`AsyncLocalStorage` là cơ chế của Node: dữ liệu đặt vào đầu request sẽ "đi theo" mọi lời gọi async phía sau, kể cả sâu 10 tầng hàm.

### `src/common/tenant/tenant.context.ts`

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStore = {
  tenantId: string;
  userId?: string;   // chỉ có ở request dashboard, request widget thì không
};

const als = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  run<T>(store: TenantStore, fn: () => T): T {
    return als.run(store, fn);
  },
  get(): TenantStore | undefined {
    return als.getStore();
  },
  getTenantId(): string | undefined {
    return als.getStore()?.tenantId;
  },
  requireTenantId(): string {
    const id = als.getStore()?.tenantId;
    if (!id) throw new Error('TenantContext chưa được thiết lập');
    return id;
  },
};
```

**Checkpoint:** chưa chạy được gì, sang bước sau.

---

## Bước 3 — Auth module

**Mục tiêu:** đăng ký tạo `Tenant` + `User` đầu tiên; đăng nhập trả JWT chứa `tenantId`.

### Những dòng "khó nhớ", còn lại tự viết

**Sinh publicKey** (nằm trong snippet widget, công khai):
```ts
import { randomBytes } from 'node:crypto';
const publicKey = 'pk_' + randomBytes(24).toString('base64url');
```

**Sinh slug** từ tên công ty, phải unique — thêm hậu tố ngẫu nhiên cho chắc:
```ts
const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
           + '-' + randomBytes(3).toString('hex');
```

**Băm mật khẩu:**
```ts
import * as argon2 from 'argon2';
const passwordHash = await argon2.hash(password);
const ok = await argon2.verify(user.passwordHash, password);
```

**Tạo tenant + user trong một lệnh** (nested write, Prisma tự nối quan hệ):
```ts
const tenant = await this.prisma.tenant.create({
  data: {
    name: companyName,
    slug,
    publicKey,
    users: { create: { email, passwordHash } },
  },
  include: { users: true },
});
```

**Ký JWT** — payload phải có `tenantId`, đây là thứ toàn bộ cơ chế cô lập dựa vào:
```ts
this.jwt.signAsync({ sub: user.id, tenantId: user.tenantId, email: user.email })
```

### `src/auth/auth.module.ts`

```ts
JwtModule.registerAsync({
  global: true,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: { expiresIn: '7d' },
  }),
}),
```

Nhớ thêm `JWT_SECRET` vào `backend/.env`.

### Tự viết nốt

- `dto/register.dto.ts` — `companyName`, `email`, `password` với `class-validator` (`@IsEmail()`, `@MinLength(8)`)
- `dto/login.dto.ts`
- `auth.controller.ts` — `POST /api/auth/register`, `POST /api/auth/login`
- Bật validation trong `main.ts`: `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))`

**Checkpoint:**
```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" ^
  -d "{\"companyName\":\"Acme\",\"email\":\"a@acme.com\",\"password\":\"password123\"}"
```
Phải nhận được token. Mở `npx prisma studio` → bảng `Tenant` có 1 dòng, `publicKey` bắt đầu bằng `pk_`.

---

## Bước 4 — Middleware đặt context

**Mục tiêu:** một chỗ duy nhất xác định "request này thuộc công ty nào", phục vụ **cả hai** loại API.

Đây là điểm hay của thiết kế: `/api/*` lấy tenant từ JWT, `/public/*` lấy từ publicKey — nhưng phần còn lại của hệ thống không cần biết sự khác biệt đó.

### `src/common/tenant/tenant.middleware.ts`

```ts
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { PRISMA, ExtendedPrismaClient } from '../../prisma/prisma';
import { TenantContext, TenantStore } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const store = await this.resolve(req);

    // Không xác định được tenant → vẫn cho đi tiếp, Guard sẽ chặn nếu route yêu cầu
    if (!store) return next();

    // Mọi thứ chạy sau next() đều nhìn thấy store này
    TenantContext.run(store, () => next());
  }

  private async resolve(req: Request): Promise<TenantStore | null> {
    // 1. Dashboard — Bearer token
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const p = await this.jwt.verifyAsync(auth.slice(7));
        return { tenantId: p.tenantId, userId: p.sub };
      } catch {
        return null;   // token hỏng/hết hạn
      }
    }

    // 2. Widget — publicKey
    const key = (req.body?.publicKey ?? req.query?.key) as string | undefined;
    if (key) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { publicKey: key },
        select: { id: true },
      });
      if (tenant) return { tenantId: tenant.id };
    }

    return null;
  }
}
```

Đăng ký trong `AppModule`:
```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

> ⚠️ Truy vấn `tenant.findUnique` ở đây chạy **trước khi** có context nên extension không lọc — đúng ý đồ. Đây là lý do `Tenant` không nằm trong `TENANT_MODELS`.

---

## Bước 5 — Guard + decorator

### `src/common/tenant/jwt-auth.guard.ts`

Middleware đã verify JWT rồi, Guard chỉ cần kiểm tra kết quả:

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(): boolean {
    const store = TenantContext.get();
    if (!store?.userId) throw new UnauthorizedException();
    return true;
  }
}
```

### `current-user.decorator.ts`

```ts
export const CurrentTenant = createParamDecorator(
  () => TenantContext.requireTenantId(),
);
```

Dùng: gắn `@UseGuards(JwtAuthGuard)` lên mọi controller `/api/*`. Route `/public/*` **không** gắn.

---

## Bước 6 — Test cô lập tenant *(bắt buộc, không được bỏ)*

Đây là thứ quyết định giai đoạn 1 xong hay chưa.

### Kịch bản thủ công

```bash
# 1. Tạo 2 công ty
TOKEN_A=$(curl -s -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Acme","email":"a@acme.com","password":"password123"}' | jq -r .accessToken)

TOKEN_B=$(curl -s -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Globex","email":"b@globex.com","password":"password123"}' | jq -r .accessToken)

# 2. Mỗi bên tạo 1 document (dùng Prisma Studio nếu chưa có endpoint upload)

# 3. Dùng token A gọi list → CHỈ được thấy document của A
curl -s localhost:3000/api/documents -H "Authorization: Bearer $TOKEN_A"

# 4. ⭐ Phép thử quan trọng nhất: token A + ID document của B
curl -s localhost:3000/api/documents/<ID_CUA_B> -H "Authorization: Bearer $TOKEN_A"
#    Phải trả 404, KHÔNG được trả dữ liệu
```

### Các trường hợp phải pass

- [ ] Token A list documents → không thấy document nào của B
- [ ] Token A + documentId của B → 404 (không phải 200)
- [ ] Không có token → 401
- [ ] Token hỏng/hết hạn → 401
- [ ] publicKey của A gọi `/public/*` → chỉ chạm dữ liệu A
- [ ] Xóa tenant A → mọi dữ liệu con của A biến mất (`onDelete: Cascade`), dữ liệu B nguyên vẹn

Nên viết thành `test/tenant-isolation.e2e-spec.ts` để chạy lại mỗi lần sửa code. Test này sẽ bảo vệ bạn suốt phần đời còn lại của dự án.

---

## Checklist hoàn thành giai đoạn 1

- [ ] Chốt cách login (A hay B ở đầu tài liệu)
- [ ] `prisma.ts` + `prisma.module.ts` — client có extension
- [ ] `tenant.context.ts`
- [ ] Auth: register + login trả JWT chứa `tenantId`
- [ ] `tenant.middleware.ts` xử lý cả JWT lẫn publicKey
- [ ] `JwtAuthGuard` + decorator
- [ ] **Test cô lập A/B pass hết**
- [ ] `generated/` đã có trong `.gitignore`

Xong hết → sang giai đoạn 2 (ingest PDF).

---

## Gỡ rối thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| Query vẫn trả dữ liệu tenant khác | Quên `@Inject(PRISMA)`, đang dùng `new PrismaClient()` trần |
| `TenantContext chưa được thiết lập` | Middleware chưa `forRoutes('*')`, hoặc request không có token/publicKey |
| Context "biến mất" giữa chừng | Có chỗ dùng callback kiểu cũ hoặc `setTimeout` phá vỡ chuỗi async |
| Type error ở `where.tenantId` | Ép kiểu `(args as any)` như code mẫu, hoặc đổi `findUnique` → `findFirst` |
| Index vector biến mất sau khi migrate | Chạy lại `npm run db:vector-index` |
