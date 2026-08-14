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
