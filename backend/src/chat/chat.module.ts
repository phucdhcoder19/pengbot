import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RagModule } from '../rag/rag.module';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';

@Module({
  imports: [RagModule, RateLimitModule], // RetrieverService + AnswererService + ChatRateLimitGuard
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
