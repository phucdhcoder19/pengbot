import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../common/tenant/jwt-auth.guard';

@Controller('api/conversations')
@UseGuards(JwtAuthGuard) // gắn ở CONTROLLER — quên một route là thủng
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(
    // Query string luôn là chuỗi. ParseIntPipe đổi sang số và trả 400 nếu
    // ai đó gửi ?page=abc — không có nó thì skip: NaN và Prisma ném lỗi lạ.
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // Chặn ?limit=999999 kéo cả bảng về làm sập server
    return this.conversations.list(Math.max(page, 1), Math.min(Math.max(limit, 1), 100));
  }

  @Get(':id')
  detail(
    // Id không phải UUID thì chặn ngay ở đây, khỏi phải đi tới DB
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversations.detail(id);
  }
}
