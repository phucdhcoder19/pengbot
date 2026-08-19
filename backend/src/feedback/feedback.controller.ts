import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackDto } from './dto/feedback.dto';
import { PublicWidgetGuard } from '../common/tenant/public-widget.guard';
import { FeedbackRateLimitGuard } from '../common/rate-limit/feedback-rate-limit.guard';

/**
 * 👍/👎 từ widget. Công khai như /public/chat: khách vào website của công ty
 * khách hàng thì không có tài khoản, chỉ có publicKey trong snippet.
 */
@Controller('public')
@UseGuards(PublicWidgetGuard, FeedbackRateLimitGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post('feedback')
  // POST mặc định 201; đây là cập nhật một bản ghi có sẵn nên 200 đúng hơn.
  @HttpCode(HttpStatus.OK)
  submit(@Body() dto: FeedbackDto) {
    return this.feedback.submit(dto);
  }
}
