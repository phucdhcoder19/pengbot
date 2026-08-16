import { fuse } from './rrf';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const L = (...ids: string[]) => ids.map((id) => ({ id }));

describe('RRF — Reciprocal Rank Fusion', () => {
  it('ví dụ trong tài liệu: C5 bị vector xếp bét vẫn lên top 3 nhờ từ khoá', () => {
    const out = fuse(
      [L('C1', 'C2', 'C6', 'C3', 'C5'), L('C5', 'C2', 'C1')],
      (x) => x.id,
    );
    expect(ids(out)).toEqual(['C1', 'C2', 'C5', 'C6', 'C3']);
  });

  it('điểm = tổng 1/(60+hạng) ở mỗi bảng, vắng mặt = 0', () => {
    const out = fuse([L('a', 'b'), L('b')], (x) => x.id);
    const a = out.find((x) => x.id === 'a')!;
    const b = out.find((x) => x.id === 'b')!;
    expect(a.score).toBeCloseTo(1 / 61, 10);
    expect(b.score).toBeCloseTo(1 / 62 + 1 / 61, 10);
    expect(a.ranks).toEqual([1, null]);
    expect(b.ranks).toEqual([2, 1]);
  });

  it('mục có mặt ở cả hai bảng thắng mục chỉ đứng nhất một bảng', () => {
    // 'x' nhất bảng 1 nhưng bảng 2 không nhắc; 'y' hạng 2 ở cả hai.
    const out = fuse([L('x', 'y'), L('z', 'y')], (x) => x.id);
    expect(ids(out)[0]).toBe('y');
  });

  it('một bảng rỗng không làm hỏng gì', () => {
    expect(ids(fuse([L('a', 'b'), []], (x) => x.id))).toEqual(['a', 'b']);
    expect(fuse([[], []], (x: { id: string }) => x.id)).toEqual([]);
  });

  it('hoà điểm → phá hoà bằng hạng tốt nhất, không phụ thuộc thứ tự bảng', () => {
    // a: hạng 1 bảng 1, vắng bảng 2 → 1/61.  b: vắng bảng 1, hạng 1 bảng 2 → 1/61.
    // Hoà thật sự → giữ ổn định: cả hai đều bestRank=1, sort ổn định theo
    // thứ tự chèn (a gặp trước).
    expect(ids(fuse([L('a'), L('b')], (x) => x.id))).toEqual(['a', 'b']);
    // c: hạng 2 bảng 1 (1/62) và  d: hạng 2 bảng 2 (1/62) — hoà, bestRank bằng
    // nhau → thứ tự chèn. Còn 'e' hạng 1 bảng 1 + không đâu khác = 1/61 > 1/62.
    expect(ids(fuse([L('e', 'c'), L('f', 'd')], (x) => x.id))).toEqual([
      'e',
      'f',
      'c',
      'd',
    ]);
  });

  it('giữ nguyên các trường của mục gốc (bản gặp đầu tiên)', () => {
    const out = fuse(
      [[{ id: 'a', v: 'từ vector' }], [{ id: 'a', v: 'từ từ khoá' }]],
      (x) => x.id,
    );
    expect(out).toHaveLength(1);
    expect(out[0].v).toBe('từ vector');
  });
});
