import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmbeddingService } from './embedding.service';
import { IngestProcessor, INGEST_QUEUE } from './ingest.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 3, // hỏng thì thử lại 3 lần
        backoff: { type: 'exponential', delay: 5000 }, // 5s → 10s → 20s
        removeOnComplete: 100, // giữ 100 job xong gần nhất, còn lại xoá
        removeOnFail: 500, // giữ 500 job hỏng để còn điều tra
      },
    }),
  ],
  providers: [EmbeddingService, IngestProcessor],
  // export để DocumentsModule inject được ĐÚNG cái queue này
  exports: [BullModule],
})
export class IngestModule {}
