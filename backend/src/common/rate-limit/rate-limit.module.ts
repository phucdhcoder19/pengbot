import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { ChatRateLimitGuard } from './chat-rate-limit.guard';
import { QuotaService } from './quota.service';

/// RedisModule là @Global nên không cần import ở đây.
/// PrismaModule cũng vậy (xem prisma.module.ts).
@Module({
  providers: [RateLimitService, QuotaService, ChatRateLimitGuard],
  exports: [RateLimitService, QuotaService, ChatRateLimitGuard],
})
export class RateLimitModule {}
