import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';
import { TenantContext } from '../common/tenant/tenant.context';
import type { FeedbackDto } from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly log = new Logger(FeedbackService.name);

  constructor(@Inject(PRISMA) private readonly prisma: ExtendedPrismaClient) {}

  /**
   * Ghi 👍/👎 của khách lên một câu trả lời.
   *
   * Ba lớp kiểm, vì đây là endpoint CÔNG KHAI và publicKey ai cũng đọc được:
   *   1. message phải thuộc tenant  — findFirst đi qua Prisma extension
   *   2. message phải là của BOT    — chấm câu hỏi của chính khách là vô nghĩa
   *   3. người chấm phải là chủ hội thoại — xem ghi chú bên dưới
   */
  async submit(dto: FeedbackDto) {
    const tenantId = TenantContext.requireTenantId();

    // findFirst (KHÔNG phải findUnique): extension chỉ chèn được WHERE tenantId
    // vào findFirst. Công ty A truyền messageId của B sẽ nhận null → 404,
    // không lộ cả việc id đó có tồn tại hay không.
    const message = await this.prisma.message.findFirst({
      where: { id: dto.messageId },
      select: {
        id: true,
        role: true,
        feedback: true,
        conversation: { select: { visitorId: true } },
      },
    });

    if (!message) throw new NotFoundException('Không tìm thấy câu trả lời');

    if (message.role !== 'ASSISTANT') {
      throw new BadRequestException('Chỉ đánh giá được câu trả lời của bot');
    }

    // Chủ hội thoại. visitorId do client tự sinh nên KHÔNG phải xác thực thật,
    // nhưng nó là UUID không đoán được — đủ để chặn kẻ cầm publicKey đi dìm
    // hàng loạt câu trả lời trong hội thoại của người khác.
    //
    // Hội thoại không có visitorId (khách chặn localStorage) thì bỏ qua bước
    // này: thà nhận feedback còn hơn từ chối một người dùng hợp lệ.
    const owner = message.conversation.visitorId;
    if (owner && owner !== dto.visitorId) {
      throw new ForbiddenException('Không phải hội thoại của bạn');
    }

    const feedback = dto.vote === 'NONE' ? null : dto.vote;

    await this.prisma.message.update({
      where: { id: message.id },
      // feedbackAt về null cùng lúc: giữ lại mốc thời gian của một đánh giá
      // đã bị rút lại chỉ làm dữ liệu khó đọc.
      data: { feedback, feedbackAt: feedback ? new Date() : null },
    });

    this.log.log(
      `feedback tenant=${tenantId} message=${message.id} ${message.feedback ?? '-'} → ${feedback ?? '-'}`,
    );

    return { messageId: message.id, feedback };
  }
}
