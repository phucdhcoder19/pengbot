import { Injectable, Logger } from '@nestjs/common';

/// Phải khớp vector(1536) trong schema.prisma. Đổi số này = re-embed toàn bộ tài liệu.
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
    // Sai chỗ này thì content và vector lệch nhau: retrieve ra kết quả vô lý
    // mà không có lỗi nào để lần ra.
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
    seed = (seed * 1664525 + 1013904223) >>> 0; // LCG — bộ sinh số giả ngẫu nhiên
    out[i] = seed / 0xffffffff - 0.5;
    sumSq += out[i] * out[i];
  }

  // Chuẩn hoá về độ dài 1, giống vector thật của OpenAI
  const norm = Math.sqrt(sumSq) || 1;
  return out.map((v) => v / norm);
}
