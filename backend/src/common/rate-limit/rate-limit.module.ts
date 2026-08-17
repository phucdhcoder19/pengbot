import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { ChatRateLimitGuard } from './chat-rate-limit.guard';

/// RedisModule là @Global nên không cần import ở đây.
/// PrismaModule cũng vậy (xem prisma.module.ts).
@Module({
  providers: [RateLimitService, ChatRateLimitGuard],
  exports: [RateLimitService, ChatRateLimitGuard],
})
export class RateLimitModule {}
