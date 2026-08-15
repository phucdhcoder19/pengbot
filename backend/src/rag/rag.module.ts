import { Module } from '@nestjs/common';
import { RetrieverService } from './retriever.service';
import { AnswererService } from './answerer.service';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [IngestModule], // cần EmbeddingService
  providers: [RetrieverService, AnswererService],
  exports: [RetrieverService, AnswererService],
})
export class RagModule {}
