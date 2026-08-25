/**
 * Demo hybrid search trên dữ liệu thật trong DB.
 *
 *   npm run demo:hybrid -- <tenantId> "<câu hỏi>"
 *
 * In ra top-k kèm thứ hạng ở từng nhánh: v = vector, k = từ khoá, '-' = nhánh
 * đó không tìm ra. Dùng để "nhìn" RRF làm gì với một câu hỏi cụ thể.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RetrieverService } from '../src/rag/retriever.service';
import { keywordQueryText } from '../src/rag/keyword-query';
import { TenantContext } from '../src/common/tenant/tenant.context';

async function main() {
  const [tenantId, question] = process.argv.slice(2);
  if (!tenantId || !question) {
    console.error('cách dùng: demo-hybrid.ts <tenantId> "<câu hỏi>"');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const retriever = app.get(RetrieverService);

  console.log(`câu hỏi      : ${question}`);
  console.log(`từ khoá gửi  : "${keywordQueryText(question)}"`);
  console.log(`ngưỡng nghĩa : ${process.env.RAG_MAX_DISTANCE ?? 0.4}\n`);

  const chunks = await TenantContext.run({ tenantId }, () =>
    retriever.retrieve(question),
  );

  for (const c of chunks) {
    const v = c.vectorRank ?? '-';
    const k = c.keywordRank ?? '-';
    console.log(
      `v${v} k${k}  dist=${c.distance.toFixed(3)}  rrf=${c.score.toFixed(4)}  ` +
        `[${c.documentTitle}] ${c.content.replace(/\s+/g, ' ').slice(0, 80)}`,
    );
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
