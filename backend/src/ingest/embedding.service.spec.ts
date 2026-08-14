import { EmbeddingService } from './embedding.service';

describe('EmbeddingService — chế độ vector giả', () => {
  const service = new EmbeddingService();

  beforeAll(() => {
    delete process.env.EMBEDDING_API_KEY; // ép đi nhánh fake, không gọi mạng
  });

  it('mảng rỗng → mảng rỗng, không gọi API', async () => {
    expect(await service.embedBatch([])).toEqual([]);
  });

  it('trả đúng số lượng vector, mỗi vector 1536 chiều', async () => {
    const vectors = await service.embedBatch(['một', 'hai', 'ba']);

    expect(vectors).toHaveLength(3);
    for (const v of vectors) expect(v).toHaveLength(1536);
  });

  it('tất định: cùng text → cùng vector', async () => {
    const [a] = await service.embedBatch(['xin chào']);
    const [b] = await service.embedBatch(['xin chào']);

    expect(a).toEqual(b);
  });

  it('text khác nhau → vector khác nhau', async () => {
    const [a, b] = await service.embedBatch(['xin chào', 'tạm biệt']);

    expect(a).not.toEqual(b);
  });

  it('vector đã chuẩn hoá về độ dài 1', async () => {
    const [v] = await service.embedBatch(['bất kỳ']);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));

    expect(norm).toBeCloseTo(1, 5);
  });
});
