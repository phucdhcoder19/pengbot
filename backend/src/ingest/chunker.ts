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
      // chỉ lùi nếu ranh giới không quá gần đầu chunk, tránh tạo chunk tí hon
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
