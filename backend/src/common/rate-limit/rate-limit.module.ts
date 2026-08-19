import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { ChatRateLimitGuard } from './chat-rate-limit.guard';
import { QuotaService } from './quota.service';
import { FeedbackRateLimitGuard } from './feedback-rate-limit.guard';

/// RedisModule là @Global nên không cần import ở đây.
/// PrismaModule cũng vậy (xem prisma.module.ts).
@Module({
  providers: [
    RateLimitService,
    QuotaService,
    ChatRateLimitGuard,
    FeedbackRateLimitGuard,
  ],
  exports: [
    RateLimitService,
    QuotaService,
    ChatRateLimitGuard,
    FeedbackRateLimitGuard,
  ],
})
export class RateLimitModule {}
