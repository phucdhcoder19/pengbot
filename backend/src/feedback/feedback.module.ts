import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';

@Module({
  imports: [RateLimitModule], // FeedbackRateLimitGuard
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
