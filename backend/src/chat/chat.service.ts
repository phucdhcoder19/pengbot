import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';
import { RetrieverService } from '../rag/retriever.service';
import {
  AnswererService,
  type ChatTurn,
  type Citation,
  type RagAnswer,
} from '../rag/answerer.service';
import type { ChatDto } from './dto/chat.dto';

export type ChatReply = {
  conversationId: string;
  answer: string;
  citations: Citation[];
  confidence: number;
};

/// Số lượt gần nhất đưa vào ngữ cảnh. 6 message ≈ 3 lượt hỏi–đáp: đủ để hiểu
/// "còn phí thì sao?", chưa đủ dài để phình prompt.
const HISTORY_LIMIT = 6;

/// Trần số message mỗi hội thoại. Chạm trần thì tự mở phiên mới thay vì để
/// một conversationId phình vô hạn.
const MAX_MESSAGES_PER_CONVERSATION = 200;

const LOI_HE_THONG =
  'Xin lỗi, hệ thống đang gặp sự cố. Bạn vui lòng thử lại sau ít phút.';

@Injectable()
export class ChatService {
  private readonly log = new Logger(ChatService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    private readonly retriever: RetrieverService,
    private readonly answerer: AnswererService,
  ) {}

  async chat(dto: ChatDto): Promise<ChatReply> {
    const conversation = await this.resolveConversation(dto);

    // Lưu câu hỏi TRƯỚC khi gọi LLM. Nếu LLM hỏng, ta vẫn còn bằng chứng
    // khách đã hỏi gì — đó là thứ cần nhất lúc điều tra sự cố.
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: dto.message,
      } as any,
    });

    const history = await this.loadHistory(conversation.id);
    const result = await this.answerWithFallback(dto.message, history);

    // Gom các thao tác ghi sau khi đã có câu trả lời vào MỘT transaction.
    // Lời gọi LLM nằm ngoài — ôm nó trong transaction là giữ kết nối DB
    // suốt 2 giây chờ mạng, rất tốn với endpoint công khai.
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: result.answer,
          citations: result.citations,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
        } as any,
      }),
      // Chỉ tính tiền khi thật sự gọi LLM. Câu "không có thông tin" và câu
      // báo lỗi hệ thống đều không tốn token nên không được tính.
      ...(result.usedLlm
        ? [this.prisma.usageEvent.create({ data: { type: 'AI_MESSAGE' } as any })]
        : []),
      // @updatedAt chỉ tự chạy khi có UPDATE. Thêm Message không phải là update
      // Conversation, nên phải chạm tay vào để dashboard sắp đúng thứ tự.
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    this.log.log(
      `chat conv=${conversation.id} history=${history.length} llm=${result.usedLlm} tokens=${result.tokensUsed}`,
    );

    return {
      conversationId: conversation.id,
      answer: result.answer,
      citations: result.citations,
      confidence: result.confidence,
    };
  }

  /**
   * Viết lại câu hỏi theo ngữ cảnh → retrieve → sinh câu trả lời.
   * Hỏng ở bất kỳ đâu thì trả câu xin lỗi lịch sự thay vì để 500 lọt ra widget.
   */
  private async answerWithFallback(
    message: string,
    history: ChatTurn[],
  ): Promise<RagAnswer> {
    try {
      // Câu hỏi đem đi EMBED phải là câu độc lập. "Còn phí thì sao?" tự nó
      // không mang ngữ nghĩa gì để tìm kiếm.
      const standalone = await this.answerer.rewriteQuestion(message, history);
      const chunks = await this.retriever.retrieve(standalone);

      // Nhưng câu đưa cho LLM trả lời vẫn là câu GỐC — kèm lịch sử, model
      // tự hiểu ngữ cảnh và giữ được giọng hội thoại tự nhiên.
      return await this.answerer.answer(message, chunks, history);
    } catch (err) {
      const chiTiet = err instanceof Error ? err.message : String(err);
      this.log.error(`Không trả lời được: ${chiTiet}`);

      // Vẫn trả về một RagAnswer hợp lệ để luồng chính ghi Message như thường.
      // Không có nó thì hội thoại có câu hỏi mà thiếu hẳn câu trả lời.
      return {
        answer: LOI_HE_THONG,
        citations: [],
        confidence: 0,
        usedLlm: false, // KHÔNG tính tiền khách cho một lần hệ thống hỏng
        tokensUsed: 0,
      };
    }
  }

  /** Lấy vài lượt gần nhất, sắp lại theo thứ tự thời gian tăng dần. */
  private async loadHistory(conversationId: string): Promise<ChatTurn[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }, // lấy MỚI nhất...
      take: HISTORY_LIMIT + 1, // +1 để bỏ câu vừa lưu ở trên
      select: { role: true, content: true },
    });

    return (
      rows
        .slice(1) // bỏ chính câu hỏi vừa lưu, nó không phải "lịch sử"
        .reverse() // ...rồi đảo lại cho đúng thứ tự hội thoại
        .map((m) => ({ role: m.role, content: m.content })) as ChatTurn[]
    );
  }

  /** Tìm phiên cũ, không thấy hoặc đã quá dài thì mở phiên mới. */
  private async resolveConversation(dto: ChatDto) {
    if (dto.conversationId) {
      // findFirst đi qua extension → tự có WHERE tenantId.
      // Khách truyền conversationId của công ty KHÁC sẽ nhận null ở đây,
      // rồi rơi xuống nhánh tạo mới. Không rò rỉ, không báo lỗi lộ thông tin.
      const existing = await this.prisma.conversation.findFirst({
        where: { id: dto.conversationId },
        include: { _count: { select: { messages: true } } },
      });

      if (existing) {
        if (existing._count.messages < MAX_MESSAGES_PER_CONVERSATION) {
          return existing;
        }
        // Chạm trần: mở phiên mới thay vì từ chối. Khách không mất mạch chat,
        // chỉ là lịch sử bị cắt — với chatbot support thì đó là đánh đổi đúng.
        this.log.warn(
          `Hội thoại ${existing.id} đã đạt trần ${MAX_MESSAGES_PER_CONVERSATION} message, mở phiên mới`,
        );
      }
    }

    return this.prisma.conversation.create({
      data: { visitorId: dto.visitorId } as any,
    });
  }
}
