/**
 * Reciprocal Rank Fusion — gộp nhiều bảng xếp hạng thành một.
 *
 * Bài toán: nhánh vector chấm bằng cosine distance (nhỏ = tốt, thang 0..2),
 * nhánh từ khoá chấm bằng ts_rank (lớn = tốt, thang không cố định). Hai thang
 * đo khác nhau, KHÔNG cộng thẳng điểm được.
 *
 * Cách giải: vứt điểm số, chỉ giữ THỨ HẠNG. Mỗi mục được thưởng 1/(K + hạng)
 * ở mỗi bảng nó có mặt, vắng mặt thì 0. Cộng lại. Mục nào được CẢ HAI bảng
 * xếp khá thì có tổng gần gấp đôi mục chỉ một bảng nhắc → nổi lên đầu.
 *
 *   Vector nói:   [C1, C2, C6, C3, C5]
 *   Từ khoá nói:  [C5, C2, C1]
 *   RRF:          C1 = 1/61 + 1/63,  C2 = 1/62 + 1/62,  C5 = 1/65 + 1/61,
 *                 C6 = 1/63 + 0,     C3 = 1/64 + 0
 *   Kết quả:      [C1, C2, C5, C6, C3]  ← C5 từ hạng 5 nhảy lên 3
 *
 * K = 60 (theo paper gốc, Cormack 2009). K lớn làm dải điểm phẳng ra: hạng 1
 * và hạng 5 chỉ chênh ~7%, nên KHÔNG bảng nào một mình quyết được — thứ tạo
 * chênh lệch lớn là "có mặt ở cả hai bảng hay không". Đó là chủ đích: ưu tiên
 * sự đồng thuận, không phải "một bên hét to".
 */

export const RRF_K = 60;

/// Kết quả gộp: giữ nguyên mục gốc, gắn thêm điểm và thứ hạng ở từng bảng
/// (null = bảng đó không nhắc tới). Hạng đếm từ 1.
export type Fused<T> = T & {
  score: number;
  ranks: (number | null)[];
};

/**
 * @param lists  các bảng xếp hạng, mỗi bảng đã sắp từ tốt nhất → kém nhất
 * @param keyOf  cách nhận ra cùng một mục xuất hiện ở nhiều bảng
 *
 * Trả về mảng đã sắp theo score giảm dần. Hoà điểm thì phá hoà bằng thứ hạng
 * tốt nhất ở bất kỳ bảng nào (mục nào từng đứng cao hơn thì lên trước) — để
 * kết quả tất định giữa các lần chạy, không phụ thuộc thứ tự bảng.
 */
export function fuse<T>(
  lists: readonly (readonly T[])[],
  keyOf: (item: T) => string,
  k = RRF_K,
): Fused<T>[] {
  const byKey = new Map<string, Fused<T>>();

  lists.forEach((list, listIdx) => {
    list.forEach((item, i) => {
      const rank = i + 1;
      const key = keyOf(item);
      let f = byKey.get(key);
      if (!f) {
        // Bản ghi đầu tiên gặp là bản gốc; các bảng sau chỉ cộng điểm.
        f = { ...item, score: 0, ranks: lists.map(() => null) };
        byKey.set(key, f);
      }
      f.score += 1 / (k + rank);
      f.ranks[listIdx] = rank;
    });
  });

  return [...byKey.values()].sort(
    (a, b) => b.score - a.score || bestRank(a) - bestRank(b),
  );
}

function bestRank<T>(f: Fused<T>): number {
  return Math.min(...f.ranks.map((r) => r ?? Number.POSITIVE_INFINITY));
}
