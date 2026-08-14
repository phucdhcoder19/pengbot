# Giai đoạn 2 — Ingest PDF

> Hướng dẫn tự làm. Mỗi bước có **mục tiêu**, **code cần gõ**, và **checkpoint**.
> Giai đoạn 1 đã xong (9/9 test cô lập pass). Đây là luồng bất đồng bộ đầu tiên của dự án.

**Xong giai đoạn này khi:** upload 1 PDF → sau vài giây `status = READY`, `chunkCount > 0`, mọi `Chunk` có đúng `tenantId`, và công ty A không thấy chunk của công ty B.

---

## Quyết định đã chốt

### Nhà cung cấp embedding: OpenAI `text-embedding-3-small` (1536 chiều)

Lý do: `schema.prisma` đã khai `vector(1536)` — đúng số chiều của model này, **không phải migrate lại gì cả**.

Nếu sau này muốn đổi sang Voyage (`voyage-3` = 1024 chiều) thì phải:
1. Sửa `Unsupported("vector(1536)")` → `vector(1024)` trong schema
2. Chạy chu trình migrate 3 lệnh (drop index → migrate → bật lại)
3. **Re-embed toàn bộ tài liệu cũ** — vector cũ vô dụng

Nên chốt bây giờ, đừng để tới lúc có dữ liệu thật.

### Chưa có API key vẫn làm được

`EmbeddingService` dưới đây tự động rơi về **vector giả tất định** khi `EMBEDDING_API_KEY` chưa điền. Toàn bộ đường ống ingest chạy thông, checkpoint pass hết — chỉ có chất lượng retrieve là vô nghĩa. Đủ để làm xong giai đoạn 2; tới giai đoạn 3 (RAG) thì bắt buộc phải có key thật.

---

## Các file sẽ tạo

```
backend/src/
├── ingest/
│   ├── chunker.ts             ② hàm thuần, cắt text
│   ├── chunker.spec.ts        ② unit test
│   ├── embedding.service.ts   ③ gọi API embedding
│   ├── ingest.processor.ts    ⑥ worker BullMQ  ← trái tim giai đoạn này
│   └── ingest.module.ts       ④
└── documents/
    ├── documents.controller.ts  ⑤ sửa: nhận multipart
    └── documents.service.ts     ⑤ sửa: tạo Document + đẩy job
```

---

## Bước 1 — Bịt lỗ `createMany` trong extension

**Mục tiêu:** dọn nợ trước khi nó cắn.

Extension hiện tại xử lý `create` (một bản ghi, `args.data` là object) nhưng bỏ quên `createMany` (`args.data` là **mảng**). Chèn `tenantId` vào một mảng bằng spread object sẽ tạo ra rác.

Trong `src/prisma/prisma.ts`, thêm vào `switch` — đặt ngay dưới `case 'create'`:

```ts
            case 'createMany':
            case 'createManyAndReturn': {
              const rows = (args as any).data;
              (args as any).data = Array.isArray(rows)
                ? rows.map((r: any) => ({ ...r, tenantId }))
                : { ...rows, tenantId };
              break;
            }
```

> 📌 Giai đoạn này **không dùng tới** `createMany` — Chunk phải insert bằng raw SQL vì Prisma không hiểu kiểu `vector`. Vẫn thêm cho tròn, model khác sau này sẽ cần.

---

## Bước 2 — Chunker

**Mục tiêu:** cắt văn bản dài thành các đoạn đủ nhỏ để embed, **có chồng lấn** để câu trả lời không bị cụt ở ranh giới.

Đây là hàm **thuần** — không DB, không network, không Nest. Nên nó là thứ duy nhất trong dự án test được bằng unit test thật sự nhanh.

### `src/ingest/chunker.ts`

```ts
/// Ước lượng: 1 token ≈ 3 ký tự. Tiếng Anh khoảng 4, tiếng Việt tốn hơn vì dấu.
/// Lấy 3 cho an toàn — thà chunk hơi ngắn còn hơn vượt giới hạn model embedding.
const CHARS_PER_TOKEN = 3;
const MAX_CHARS = 800 * CHARS_PER_TOKEN; // 2400
const OVERLAP_CHARS = 100 * CHARS_PER_TOKEN; // 300

export function chunkText(raw: string): string[] {
  const text = raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ') // PDF hay sinh ra hàng chục khoảng trắng liền nhau
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + MAX_CHARS, text.length);

    // Chưa tới cuối văn bản → lùi điểm cắt về ranh giới đoạn/câu gần nhất.
    // Cắt ngang giữa câu làm chunk mất nghĩa, embedding kém hẳn.
    if (end < text.length) {
      const window = text.slice(start, end);
      const br = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '));
      // chỉ lùi nếu ranh giới không quá gần đầu chunk, tránh chunk tí hon
      if (br > MAX_CHARS / 2) end = start + br + 1;
    }

    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= text.length) break;
    start = end - OVERLAP_CHARS; // lùi lại → chunk sau chồng lấn chunk trước
  }

  return chunks;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
```

**Vì sao cần chồng lấn:** nếu một câu trả lời nằm vắt qua ranh giới hai chunk, không chunk nào chứa đủ ý. Chồng 100 token đảm bảo mọi đoạn văn ngắn đều nằm trọn trong ít nhất một chunk.

### `src/ingest/chunker.spec.ts`

```ts
import { chunkText, estimateTokens } from './chunker';

describe('chunkText', () => {
  it('văn bản rỗng → mảng rỗng', () => {
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('văn bản ngắn → đúng 1 chunk', () => {
    expect(chunkText('Xin chào.')).toEqual(['Xin chào.']);
  });

  it('văn bản dài → nhiều chunk, không chunk nào vượt giới hạn', () => {
    const text = 'Câu số một. '.repeat(1000); // ~12.000 ký tự
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(4);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2400);
  });

  it('hai chunk liên tiếp phải chồng lấn', () => {
    const text = Array.from({ length: 400 }, (_, i) => `Đoạn ${i}.`).join(' ');
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    // 20 ký tự cuối của chunk trước phải nằm trong chunk sau
    expect(chunks[1]).toContain(chunks[0].slice(-20));
  });
});

describe('estimateTokens', () => {
  it('ước lượng theo độ dài', () => {
    expect(estimateTokens('abcdef')).toBe(2);
  });
});
```

**Checkpoint:**
```bash
npm test -- chunker
```
5 test xanh. Đây là test chạy trong mili-giây, không cần Docker.

---

## Bước 3 — EmbeddingService

**Mục tiêu:** biến một **mảng** text thành một **mảng** vector, gọi API theo lô.

### `src/ingest/embedding.service.ts`

```ts
import { Injectable, Logger } from '@nestjs/common';

/// Phải khớp vector(1536) trong schema.prisma. Đổi số này = re-embed toàn bộ.
const DIMENSIONS = 1536;
const MODEL = 'text-embedding-3-small';

@Injectable()
export class EmbeddingService {
  private readonly log = new Logger(EmbeddingService.name);

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    const key = process.env.EMBEDDING_API_KEY;
    if (!key || key === '...') {
      this.log.warn(
        'Chưa có EMBEDDING_API_KEY → dùng vector giả. Ingest chạy được nhưng RAG sẽ trả lời bậy.',
      );
      return texts.map(fakeEmbedding);
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: MODEL, input: texts }),
    });

    if (!res.ok) {
      throw new Error(`Embedding API lỗi ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };

    // ⚠️ API không cam kết trả về đúng thứ tự đã gửi → phải sắp lại theo index.
    // Sai chỗ này thì content và vector lệch nhau, retrieve ra kết quả vô lý
    // mà không có lỗi nào để lần.
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/// Vector giả **tất định** (cùng text → cùng vector) để chạy thử đường ống khi chưa có key.
/// Không mang ngữ nghĩa gì cả — chỉ để kiểm tra ingest chạy thông.
function fakeEmbedding(text: string): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }

  const out = new Array<number>(DIMENSIONS);
  let sumSq = 0;
  for (let i = 0; i < DIMENSIONS; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; // LCG
    out[i] = seed / 0xffffffff - 0.5;
    sumSq += out[i] * out[i];
  }

  const norm = Math.sqrt(sumSq) || 1;
  return out.map((v) => v / norm);
}
```

**Vì sao gọi theo lô:** 200 chunk mà gọi từng cái là 200 round-trip HTTP. Gộp 100 chunk một lần chỉ còn 2 lần gọi — nhanh hơn hàng chục lần và rẻ hơn.

---

## Bước 4 — Cắm BullMQ

**Mục tiêu:** có hàng đợi để đẩy việc nặng sang tiến trình nền.

### Sửa `src/app.module.ts`

Thêm import và nhét vào `imports` — **sau** `ConfigModule`:

```ts
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { IngestModule } from './ingest/ingest.module';
```
```ts
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    IngestModule,
```

### `src/ingest/ingest.module.ts`

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmbeddingService } from './embedding.service';
import { IngestProcessor, INGEST_QUEUE } from './ingest.processor';

@Module({
  imports: [BullModule.registerQueue({ name: INGEST_QUEUE })],
  providers: [EmbeddingService, IngestProcessor],
  // export BullModule để DocumentsModule inject được cùng cái queue này
  exports: [BullModule],
})
export class IngestModule {}
```

### Sửa `src/documents/document.module.ts`

```ts
import { IngestModule } from '../ingest/ingest.module';
```
```ts
@Module({
  imports: [IngestModule], // ← để inject @InjectQueue
  providers: [DocumentsService],
  controllers: [DocumentsController],
})
```

---

## Bước 5 — Upload endpoint

**Mục tiêu:** nhận file PDF, trả **202 ngay lập tức**, đẩy việc nặng vào hàng đợi.

> ⚠️ Bước này **thay thế** `POST /api/documents` cũ (chỉ nhận `{title}`). Test e2e hiện tại sẽ đỏ — sửa ở bước 7.

### Chuẩn bị

Thêm vào `backend/.gitignore`:
```
/uploads
```

Thêm vào `src/main.ts`, trước `NestFactory.create`:
```ts
import { mkdirSync } from 'node:fs';
mkdirSync('uploads', { recursive: true }); // multer không tự tạo thư mục
```

### `src/documents/documents.controller.ts`

Thay method `create` cũ:

```ts
import {
  BadRequestException,
  Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // 202: "đã nhận, đang xử lý" — KHÔNG phải 201
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, _file, cb) => cb(null, `${randomUUID()}.pdf`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) =>
        file.mimetype === 'application/pdf'
          ? cb(null, true)
          : cb(new BadRequestException('Chỉ nhận file PDF'), false),
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Thiếu file');
    return this.documents.createFromUpload(file);
  }
```

Các method `findAll` / `findOne` / `remove` giữ nguyên.

### `src/documents/documents.service.ts`

Thay method `create` cũ, thêm inject queue:

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { INGEST_QUEUE, type IngestJob } from '../ingest/ingest.processor';

  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    @InjectQueue(INGEST_QUEUE) private readonly queue: Queue<IngestJob>,
  ) {}

  async createFromUpload(file: Express.Multer.File) {
    const doc = await this.prisma.document.create({
      data: {
        title: file.originalname.replace(/\.pdf$/i, ''),
        fileName: file.originalname,
        fileSize: file.size,
        // status mặc định PENDING, sourceType mặc định PDF
      } as any,
    });

    await this.queue.add('ingest-document', {
      documentId: doc.id,
      // ⭐ Worker chạy ngoài request → không có TenantContext.
      // tenantId PHẢI đi theo payload, không có cách nào lấy lại được.
      tenantId: doc.tenantId,
      filePath: file.path,
    });

    return doc; // client poll status để biết khi nào xong
  }
```

Xoá `CreateDocumentDto` khỏi import (không dùng nữa; file dto có thể giữ lại cho giai đoạn sau).

---

## Bước 6 — Processor ⭐

**Mục tiêu:** nơi việc thật xảy ra. Đây là file quan trọng nhất giai đoạn 2.

### Hai cạm bẫy trong file này

**1. Worker không có TenantContext.** `AsyncLocalStorage` chỉ sống trong phạm vi một request HTTP. Job chạy ở tiến trình nền, context rỗng → Prisma extension **không lọc gì cả**. Phải tự dựng lại context từ payload.

**2. Insert vector phải dùng raw SQL.** Prisma không hiểu kiểu `vector`. Và raw SQL **không đi qua extension** → phải tự tay gõ `"tenantId"`. Đây là chỗ dễ rò rỉ nhất dự án.

### `src/ingest/ingest.processor.ts`

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { readFile, unlink } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';
import { TenantContext } from '../common/tenant/tenant.context';
import { chunkText, estimateTokens } from './chunker';
import { EmbeddingService } from './embedding.service';

export const INGEST_QUEUE = 'ingest';

export type IngestJob = {
  documentId: string;
  tenantId: string;
  filePath: string;
};

const EMBED_BATCH = 100;

@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  private readonly log = new Logger(IngestProcessor.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    private readonly embeddings: EmbeddingService,
  ) {
    super();
  }

  async process(job: Job<IngestJob>) {
    const { documentId, tenantId, filePath } = job.data;

    // ⭐ Cạm bẫy #1: dựng lại context cho worker.
    // Bỏ dòng này thì extension không lọc, mọi thứ vẫn "chạy" nhưng dữ liệu lẫn lộn.
    return TenantContext.run({ tenantId }, () =>
      this.ingest(documentId, filePath),
    );
  }

  private async ingest(documentId: string, filePath: string) {
    const tenantId = TenantContext.requireTenantId();

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      // 1. PDF → text  (pdf-parse v2: class, không phải hàm như v1)
      const parser = new PDFParse({ data: await readFile(filePath) });
      const { text } = await parser.getText();
      await parser.destroy();

      // 2. text → chunks
      const pieces = chunkText(text);
      if (!pieces.length) {
        throw new Error('PDF không có text — có thể là bản scan ảnh, cần OCR');
      }

      // 3. chunks → embeddings → INSERT, theo lô
      let index = 0;
      for (let i = 0; i < pieces.length; i += EMBED_BATCH) {
        const batch = pieces.slice(i, i + EMBED_BATCH);
        const vectors = await this.embeddings.embedBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          // ⭐ Cạm bẫy #2: raw SQL không qua extension → "tenantId" phải tự viết.
          await this.prisma.$executeRaw`
            INSERT INTO "Chunk"
              ("id", "tenantId", "documentId", "chunkIndex", "content", "tokenCount", "embedding")
            VALUES (
              gen_random_uuid(), ${tenantId}, ${documentId}, ${index},
              ${batch[j]}, ${estimateTokens(batch[j])},
              ${JSON.stringify(vectors[j])}::vector
            )
          `;
          index++;
        }

        await job.updateProgress(Math.round(((i + batch.length) / pieces.length) * 100));
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY', chunkCount: pieces.length, error: null },
      });

      this.log.log(`Ingest xong ${documentId}: ${pieces.length} chunk`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(`Ingest hỏng ${documentId}: ${message}`);

      // Lưu lỗi để dashboard hiện được cho người dùng, đừng nuốt im lặng
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', error: message.slice(0, 500) },
      });

      throw err; // ném lại để BullMQ đánh dấu job failed + retry theo cấu hình
    } finally {
      await unlink(filePath).catch(() => {}); // dọn file tạm, hỏng cũng kệ
    }
  }
}
```

---

## Bước 7 — Sửa test e2e cho khớp

`POST /api/documents` giờ nhận multipart và trả **202**, nên `setup()` trong `test/tenant-isolation.e2e-spec.ts` phải đổi:

```ts
    const doc = await request(http)
      .post('/api/documents')
      .set('Authorization', `Bearer ${box.token}`)
      .attach('file', Buffer.from('%PDF-1.4 noi dung gia'), 'tai-lieu.pdf')
      .expect(202);
```

> File giả này sẽ khiến worker parse hỏng → `status = FAILED`. Không sao: bài test đang kiểm tra **cô lập tenant**, không phải chất lượng parse. Việc Document vẫn được tạo và vẫn thuộc đúng tenant mới là điều cần kiểm.

Chạy lại:
```bash
npm run test:e2e
```
9/9 phải xanh lại.

---

## Bước 8 — Checkpoint thật

**Chuẩn bị:** kiếm một file PDF **có text thật** (không phải scan ảnh) — ví dụ xuất PDF từ Word.

```powershell
cd D:\pengbot\backend
npm run start:dev
```

```powershell
# Terminal 2
$A = irm http://localhost:3000/api/auth/register -Method Post -ContentType 'application/json' `
     -Body '{"companyName":"Acme","email":"ingest@acme.com","password":"password123"}'
$hA = @{ Authorization = "Bearer $($A.accessToken)" }

# Upload — dùng -Form cho multipart
$doc = irm http://localhost:3000/api/documents -Method Post -Headers $hA `
       -Form @{ file = Get-Item "D:\duong-dan\tai-lieu.pdf" }
$doc | fl id, title, status, chunkCount
```
✅ Trả về ngay, `status = PENDING`. **Không được đứng đợi** — đó là điểm của 202.

```powershell
# Đợi vài giây rồi poll
irm "http://localhost:3000/api/documents/$($doc.id)" -Headers $hA | fl status, chunkCount, error
```
✅ `status = READY`, `chunkCount > 0`. Nếu `FAILED` thì đọc `error`.

```powershell
# Đối chiếu với DB
docker exec pengbot-postgres-1 psql -U dev -d pengbot -c `
  'SELECT d.title, d.status, d."chunkCount", count(c.id) AS chunk_thuc_te
   FROM "Document" d LEFT JOIN "Chunk" c ON c."documentId" = d.id
   GROUP BY d.id, d.title, d.status, d."chunkCount";'
```
✅ `chunkCount` khớp `chunk_thuc_te`.

```powershell
# ⭐ Mọi chunk phải có tenantId, và phải khớp tenant của document
docker exec pengbot-postgres-1 psql -U dev -d pengbot -c `
  'SELECT count(*) AS chunk_sai_tenant FROM "Chunk" c
   JOIN "Document" d ON d.id = c."documentId"
   WHERE c."tenantId" IS DISTINCT FROM d."tenantId";'
```
✅ Phải là **0**. Khác 0 nghĩa là cạm bẫy #1 hoặc #2 đã cắn.

```powershell
# Vector có thật, đúng số chiều
docker exec pengbot-postgres-1 psql -U dev -d pengbot -c `
  'SELECT vector_dims(embedding) AS so_chieu, count(*) FROM "Chunk" GROUP BY 1;'
```
✅ `so_chieu = 1536`, không dòng nào NULL.

---

## Chứng minh cạm bẫy là thật

Làm một lần rồi hoàn tác — để hiểu vì sao phải có 2 dòng đó.

**Thí nghiệm 1:** trong `ingest.processor.ts`, đổi `process()` thành gọi thẳng `this.ingest(...)`, bỏ `TenantContext.run`. Upload lại → job sẽ ném lỗi `TenantContext chưa được thiết lập` ngay ở `requireTenantId()`. Đó chính là cái lưới an toàn — nếu dùng `getTenantId()` (không `require`) thì nó sẽ **âm thầm insert sai** chứ không báo gì.

**Thí nghiệm 2:** bỏ `${tenantId}` khỏi câu `INSERT` raw. Postgres sẽ báo lỗi NOT NULL — may mắn là schema có ràng buộc. Ở `SELECT` (giai đoạn 3) sẽ **không có** lưới nào bắt hộ bạn.

---

## Checklist hoàn thành giai đoạn 2

- [ ] `createMany` đã có trong extension
- [ ] `chunker.ts` + 5 unit test xanh
- [ ] `embedding.service.ts` — sắp xếp lại theo `index`
- [ ] BullMQ nối được Redis
- [ ] `POST /api/documents` nhận multipart, trả 202
- [ ] Processor có `TenantContext.run` + `"tenantId"` trong raw SQL
- [ ] Upload PDF thật → `READY`, `chunkCount > 0`
- [ ] `chunk_sai_tenant = 0`
- [ ] `vector_dims = 1536`
- [ ] Test e2e 9/9 xanh trở lại
- [ ] `/uploads` đã vào `.gitignore`

Xong hết → giai đoạn 3 (RAG). Ở đó `EMBEDDING_API_KEY` thật là bắt buộc.

---

## Gỡ rối thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| Job không chạy, `status` kẹt `PENDING` | Redis chưa lên (`docker compose ps`), hoặc quên `IngestModule` trong `AppModule` |
| `TenantContext chưa được thiết lập` trong worker | Quên bọc `TenantContext.run` ở `process()` |
| `PDF không có text` | File là bản scan ảnh — cần OCR, ngoài phạm vi dự án |
| Chunk có `tenantId` NULL | Raw SQL thiếu `${tenantId}` |
| `vector_dims` khác 1536 | Model embedding không khớp schema |
| Content và vector lệch nhau | Quên `.sort((a,b) => a.index - b.index)` trong `embedBatch` |
| `Cannot find module 'pdf-parse'` khi build | pdf-parse v2 là ESM+CJS dual — kiểm tra import dùng `{ PDFParse }` chứ không phải default import |
