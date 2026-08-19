import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';

@Injectable()
export class ConversationsService {
  constructor(@Inject(PRISMA) private readonly prisma: ExtendedPrismaClient) {}

  /**
   * @param onlyDisliked chỉ lấy hội thoại có ít nhất một câu bị 👎.
   *   Đây là màn hình đáng xem nhất với người vận hành: nơi khách đã tự
   *   chỉ ra bot trả lời sai, không phải nơi ta đoán qua confidence.
   */
  async list(page = 1, limit = 20, onlyDisliked = false) {
    const skip = (page - 1) * limit;

    // Extension tự thêm tenantId ở tầng ngoài; điều kiện lồng `messages.some`
    // không cần lọc lại vì nó chỉ soi message CỦA hội thoại đã lọc rồi.
    const where = onlyDisliked
      ? { messages: { some: { feedback: 'DOWN' as const } } }
      : {};

    // Chạy song song: danh sách và tổng số không phụ thuộc nhau.
    // Tuần tự thì mất tổng thời gian của cả hai câu.
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
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
      this.prisma.conversation.count({ where }),
    ]);

    // Số câu bị 👎 mỗi hội thoại, để vẽ huy hiệu trên hàng danh sách.
    //
    // Một câu groupBy riêng thay vì _count có điều kiện: Prisma không cho
    // vừa đếm tổng messages vừa đếm messages-đã-lọc trong cùng một _count
    // (không đặt được bí danh). Câu này bị chặn theo id của ĐÚNG trang
    // hiện tại nên luôn nhỏ, và groupBy cũng đi qua extension → có tenantId.
    const ids = rows.map((c) => c.id);
    const disliked = ids.length
      ? await this.prisma.message.groupBy({
          by: ['conversationId'],
          where: { conversationId: { in: ids }, feedback: 'DOWN' },
          _count: { _all: true },
        })
      : [];
    const dislikedBy = new Map(
      disliked.map((d) => [d.conversationId, d._count._all]),
    );

    // Nắn về đúng hình dạng UI cần. Không trả nguyên bản Prisma ra ngoài:
    // _count và messages[] là chi tiết cài đặt, frontend không nên biết.
    const items = rows.map((c) => ({
      id: c.id,
      visitorId: c.visitorId,
      messageCount: c._count.messages,
      dislikedCount: dislikedBy.get(c.id) ?? 0,
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
            feedback: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Không tìm thấy hội thoại');
    return conversation;
  }
}
