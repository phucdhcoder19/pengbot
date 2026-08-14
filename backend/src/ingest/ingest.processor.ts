import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

export const INGEST_QUEUE = 'ingest';
/// Payload của job. tenantId BẮT BUỘC có mặt ở đây — worker chạy ngoài request
/// nên không có TenantContext, không có cách nào lấy lại được nếu thiếu.
export type IngestJob = {
  documentId: string;
  tenantId: string;
  filePath: string;
};
@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  private readonly log = new Logger(IngestProcessor.name);
  // TẠM THỜI chỉ ghi log. Bước 6 sẽ thay bằng luồng ingest thật.
  async process(job: Job<IngestJob>) {
    this.log.log(`Nhận job ${job.id}: ${JSON.stringify(job.data)}`);
  }
}
