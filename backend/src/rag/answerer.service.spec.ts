import { AnswererService } from './answerer.service';
import type { RetrievedChunk } from './retriever.service';

const chunk = (distance: number, over: Partial<RetrievedChunk> = {}) =>
  ({
    id: 'c1',
    content: 'noi dung',
    documentId: 'd1',
    documentTitle: 'Tai lieu',
    distance,
    ...over,
  }) as RetrievedChunk;

describe('AnswererService — chốt chặn tin cậy', () => {
  const service = new AnswererService();

  beforeAll(() => {
    process.env.RAG_MAX_DISTANCE = '0.4';
    // Không có key → nếu code lỡ gọi fetch thì sẽ lỗi rõ ràng thay vì đốt quota
    delete process.env.LLM_API_KEY;
  });

  it('không có chunk nào → trả lời không biết, không gọi LLM', async () => {
    const r = await service.answer('cau hoi', []);

    expect(r.usedLlm).toBe(false);
    expect(r.answer).toContain('không có thông tin');
    expect(r.citations).toEqual([]);
    expect(r.tokensUsed).toBe(0);
    expect(r.confidence).toBe(0);
  });

  it('chunk quá xa ngưỡng → trả lời không biết, không gọi LLM', async () => {
    const r = await service.answer('cau hoi', [chunk(0.9)]);

    expect(r.usedLlm).toBe(false);
    expect(r.confidence).toBeCloseTo(0.55, 2); // 1 - 0.9/2
  });

  it('chỉ một chunk vượt ngưỡng cũng đủ để trả lời không biết', async () => {
    // 0.41 chỉ nhỉnh hơn ngưỡng 0.4 một chút — vẫn phải bị loại
    const r = await service.answer('cau hoi', [chunk(0.41), chunk(1.2)]);
    expect(r.usedLlm).toBe(false);
  });

  it('confidence quy đổi đúng từ cosine distance', async () => {
    expect((await service.answer('q', [chunk(2)])).confidence).toBe(0);
    expect((await service.answer('q', [chunk(1)])).confidence).toBeCloseTo(0.5);
  });

  // ───────────── hybrid search: chunk từ nhánh từ khoá ─────────────

  it('chỉ trúng từ khoá, không có neo về nghĩa → vẫn trả lời không biết', async () => {
    // ts_rank không có IDF: trúng một từ phổ biến không chứng minh gì.
    const r = await service.answer('q', [chunk(0.9, { keywordRank: 1 })]);
    expect(r.usedLlm).toBe(false);
  });

  it('confidence lấy theo chunk GẦN NHẤT, không phải chunk đứng đầu', async () => {
    // Sau RRF thứ tự không còn theo distance: chunk đầu (0.9, chỉ từ khoá),
    // chunk sau mới là neo (0.2). Confidence phải là 1 - 0.2/2 = 0.9 nếu trả
    // lời, hoặc khi từ chối phải lấy min distance.
    const r = await service.answer('q', [chunk(0.9), chunk(0.5)]);
    expect(r.usedLlm).toBe(false);
    expect(r.confidence).toBeCloseTo(0.75, 2); // 1 - 0.5/2, không phải 0.55
  });
});

describe('AnswererService — chunk đưa vào context (không gọi LLM thật)', () => {
  const service = new AnswererService();

  beforeAll(() => {
    process.env.RAG_MAX_DISTANCE = '0.4';
    delete process.env.LLM_API_KEY;
  });

  type GeminiBody = { contents: { parts: { text: string }[] }[] };

  /** Chặn fetch, bắt body gửi đi để soi context. */
  const captureBody = async (chunks: RetrievedChunk[]) => {
    const orig = globalThis.fetch;
    const sent: GeminiBody[] = [];
    const fake = (_url: unknown, init?: RequestInit) => {
      sent.push(JSON.parse(init?.body as string) as GeminiBody);
      const res = {
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'ok' }] } }],
            usageMetadata: { totalTokenCount: 1 },
          }),
      };
      return Promise.resolve(res as unknown as Response);
    };
    globalThis.fetch = fake;
    try {
      const r = await service.answer('q', chunks);
      const body = sent[0];
      const last = body.contents[body.contents.length - 1];
      return { r, context: last.parts[0].text };
    } finally {
      globalThis.fetch = orig;
    }
  };

  it('có neo về nghĩa → chunk chỉ trúng từ khoá (distance xa) vẫn vào context', async () => {
    const { r, context } = await captureBody([
      chunk(0.2, { id: 'neo', content: 'phi van chuyen 25k' }),
      chunk(0.9, { id: 'kw', content: 'ma don ACM-2024-3391', keywordRank: 1 }),
      chunk(0.9, { id: 'rac', content: 'khong lien quan' }), // xa và không từ khoá
    ]);
    expect(r.usedLlm).toBe(true);
    expect(context).toContain('ACM-2024-3391');
    expect(context).not.toContain('khong lien quan');
    expect(r.confidence).toBeCloseTo(0.9, 2); // theo neo 0.2, không phải chunk từ khoá
  });
});
