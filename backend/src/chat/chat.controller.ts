import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';
import { PublicWidgetGuard } from '../common/tenant/public-widget.guard';
import { ChatRateLimitGuard } from '../common/rate-limit/chat-rate-limit.guard';

/// Route công khai — KHÔNG gắn JwtAuthGuard. Khách vào website của công ty
/// khách hàng thì không có tài khoản, chỉ có publicKey trong snippet.
///
/// Thứ tự guard có ý nghĩa: PublicWidgetGuard xác định tenant và kiểm Origin
/// trước, ChatRateLimitGuard mới tính được hạn mức theo gói của tenant đó —
/// và publicKey sai thì bị chặn mà không tốn lượt Redis nào.
@Controller('public')
@UseGuards(PublicWidgetGuard, ChatRateLimitGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK) // đây là truy vấn, không tạo tài nguyên mới cho client
  chat(@Body() dto: ChatDto) {
    return this.chatService.chat(dto);
  }

  /**
   * Bản stream — widget dùng cái này. Trả về Server-Sent Events.
   *
   * Dùng @Res() nên Nest KHÔNG tự xử lý response: phải tự đặt header, tự
   * write, tự end. Đổi lại mới ghi được nhiều lần lên cùng một kết nối.
   */
  @Post('chat/stream')
  @HttpCode(HttpStatus.OK) // POST mặc định 201; SSE thì 200 mới đúng
  async stream(@Body() dto: ChatDto, @Res() res: Response) {
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform: cấm proxy nén hoặc gộp lại — nén là mất tính "chảy dần"
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // nginx mặc định gom buffer trước khi gửi, làm hỏng hoàn toàn SSE
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders(); // đẩy header đi ngay, đừng đợi mẩu dữ liệu đầu tiên

    try {
      for await (const ev of this.chatService.chatStream(dto)) {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      }
    } catch (err) {
      // chatStream đã tự bắt lỗi bên trong; đây là lưới cuối cho lỗi ngoài dự kiến
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: 'Có lỗi xảy ra' })}\n\n`,
      );
    } finally {
      res.end(); // thiếu dòng này thì trình duyệt treo chờ mãi
    }
  }
}
