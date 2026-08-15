import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';
import { PublicWidgetGuard } from '../common/tenant/public-widget.guard';

/// Route công khai — KHÔNG gắn JwtAuthGuard. Khách vào website của công ty
/// khách hàng thì không có tài khoản, chỉ có publicKey trong snippet.
@Controller('public')
@UseGuards(PublicWidgetGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK) // đây là truy vấn, không tạo tài nguyên mới cho client
  chat(@Body() dto: ChatDto) {
    return this.chatService.chat(dto);
  }
}
