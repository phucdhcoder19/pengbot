import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

/// Các đuôi file được nhận. Dùng chung với fileFilter ở controller
/// để hai nơi không bao giờ lệch nhau.
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'] as const;

/// Đuôi file → giá trị enum SourceType trong schema.prisma
export const SOURCE_TYPE_BY_EXT: Record<string, string> = {
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.txt': 'TXT',
  '.md': 'MD',
};

/**
 * Rút text thuần từ file bất kỳ trong danh sách hỗ trợ.
 * Phần còn lại của hệ thống chỉ làm việc với string — không quan tâm định dạng gốc.
 */
export async function extractText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf': {
      const parser = new PDFParse({ data: await readFile(filePath) });
      try {
        const { text } = await parser.getText();
        return text;
      } finally {
        // destroy() trong finally: parse hỏng vẫn phải giải phóng tài nguyên
        await parser.destroy();
      }
    }

    case '.docx': {
      // extractRawText bỏ hết định dạng, chỉ giữ chữ — đúng thứ ta cần
      const { value } = await mammoth.extractRawText({ path: filePath });
      return value;
    }

    case '.txt':
    case '.md':
      return readFile(filePath, 'utf8');

    default:
      throw new Error(`Không hỗ trợ định dạng ${ext}`);
  }
}
