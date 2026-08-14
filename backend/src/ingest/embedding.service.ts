import { Injectable, Logger } from '@nestjs/common';

/// Phải khớp vector(1536) trong schema.prisma. Đổi số này = re-embed toàn bộ.
const DIMENSIONS = 1536;
const MODEL = 'gemini-embedding-001';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`;

/// Gemini embed CÙNG một đoạn text ra vector KHÁC nhau tuỳ mục đích dùng.
/// Chunk tài liệu → RETRIEVAL_DOCUMENT. Câu hỏi của khách → RETRIEVAL_QUERY.
export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

@Injectable()
export class EmbeddingService {
  private readonly log = new Logger(EmbeddingService.name);

  async embedBatch(
    texts: string[],
    task: EmbedTask = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[][]> {
    if (!texts.length) return [];

    const key = process.env.EMBEDDING_API_KEY;
    if (!key || key === '...') {
      this.log.warn(
        'Chưa có EMBEDDING_API_KEY → dùng vector giả. Ingest chạy được nhưng RAG sẽ trả lời bậy.',
      );
      return texts.map(fakeEmbedding);
    }

    // Gemini giới hạn 100 request mỗi lần gọi batch
    if (texts.length > 100) {
      throw new Error(`Batch quá lớn: ${texts.length}, tối đa 100`);
    }

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text }] },
          taskType: task,
          outputDimensionality: DIMENSIONS,
        })),
      }),
    });

    if (!res.ok) {
      throw new Error(`Embedding API lỗi ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as { embeddings: { values: number[] }[] };

    if (json.embeddings?.length !== texts.length) {
      throw new Error(
        `Gửi ${texts.length} đoạn nhưng nhận ${json.embeddings?.length} vector`,
      );
    }

    // ⚠️ Xin ít hơn 3072 chiều = vector bị cắt bớt → KHÔNG còn độ dài 1.
    // Đo thực tế: 0.686. Bỏ bước này thì so sánh khoảng cách lệch.
    return json.embeddings.map((e) => normalize(e.values));
  }
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/// Vector giả **tất định** (cùng text → cùng vector) để chạy thử khi chưa có key.
/// Không mang ngữ nghĩa gì — chỉ để kiểm tra đường ống chạy thông.
function fakeEmbedding(text: string): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }

  const out = new Array<number>(DIMENSIONS);
  for (let i = 0; i < DIMENSIONS; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; // LCG
    out[i] = seed / 0xffffffff - 0.5;
  }

  return normalize(out);
}
