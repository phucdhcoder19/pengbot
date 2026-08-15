import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';

@Injectable()
export class ConversationsService {
  constructor(@Inject(PRISMA) private readonly prisma: ExtendedPrismaClient) {}

  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Chạy song song: danh sách và tổng số không phụ thuộc nhau.
    // Tuần tự thì mất tổng thời gian của cả hai câu.
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' }, // hoạt động gần nhất lên đầu
        skip,
        take: limit,
        include: {
          _count: { select: { messages: true } },
          // Câu hỏi ĐẦU TIÊN của khách, dùng làm dòng preview.
          // take: 1 nên Prisma không kéo cả nghìn message về chỉ để lấy một dòng.
          messages: {
            where: { role: 'USER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { content: true },
          },
        },
      }),
      this.prisma.conversation.count(),
    ]);

    // Nắn về đúng hình dạng UI cần. Không trả nguyên bản Prisma ra ngoài:
    // _count và messages[] là chi tiết cài đặt, frontend không nên biết.
    const items = rows.map((c) => ({
      id: c.id,
      visitorId: c.visitorId,
      messageCount: c._count.messages,
      preview: c.messages[0]?.content ?? '',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return { items, total, page, limit };
  }

  async detail(id: string) {
    // findFirst đi qua extension → tự có WHERE tenantId.
    // Công ty A truyền id của B sẽ nhận null → 404. Không rò rỉ, và cũng
    // không xác nhận "id đó có thật, chỉ là bạn không được xem".
    const conversation = await this.prisma.conversation.findFirst({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }, // đọc từ trên xuống như hội thoại thật
          select: {
            id: true,
            role: true,
            content: true,
            citations: true,
            confidence: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Không tìm thấy hội thoại');
    return conversation;
  }
}
