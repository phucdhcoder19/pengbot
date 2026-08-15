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
});
