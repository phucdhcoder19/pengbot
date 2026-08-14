import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { IngestModule } from 'src/ingest/ingest.module';

@Module({
  imports: [IngestModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentModule {}
