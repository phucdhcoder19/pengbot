import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';
import { RetrieverService } from '../rag/retriever.service';
import {
  AnswererService,
  type ChatTurn,
  type Citation,
  type RagAnswer,
} from '../rag/answerer.service';

/// Sự kiện gửi cho client qua SSE.
/// 'meta' đi ĐẦU TIÊN để widget lưu conversationId ngay, kể cả khi phần sau hỏng.
export type ChatEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; citations: Citation[]; confidence: number }
  | { type: 'error'; message: string };
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

const SYSTEM_ERROR =
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
    await this.persist(conversation.id, result);

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
   * Bản stream của chat(): phát từng mẩu chữ ngay khi Gemini sinh ra.
   *
   * Cùng một luồng nghiệp vụ với chat() — lưu câu hỏi, viết lại, truy hồi,
   * sinh câu trả lời, ghi sổ — chỉ khác ở chỗ câu trả lời đi ra dần thay vì
   * đợi trọn vẹn. Phần ghi DB vẫn chạy MỘT LẦN sau khi stream kết thúc.
   */
  async *chatStream(dto: ChatDto): AsyncGenerator<ChatEvent> {
    const conversation = await this.resolveConversation(dto);

    // Phát meta NGAY: widget lưu conversationId vào localStorage trước cả khi
    // có chữ đầu tiên. Nếu mạng đứt giữa chừng, lượt sau vẫn nối đúng phiên.
    yield { type: 'meta', conversationId: conversation.id };

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: dto.message,
      } as any,
    });

    const history = await this.loadHistory(conversation.id);

    let full = '';
    let citations: Citation[] = [];
    let confidence = 0;
    let usedLlm = false;
    let tokensUsed = 0;

    try {
      const standalone = await this.answerer.rewriteQuestion(
        dto.message,
        history,
      );
      const chunks = await this.retriever.retrieve(standalone);

      for await (const piece of this.answerer.answerStream(
        dto.message,
        chunks,
        history,
      )) {
        if (piece.type === 'delta') {
          full += piece.text;
          yield { type: 'delta', text: piece.text };
        } else {
          citations = piece.citations;
          confidence = piece.confidence;
          usedLlm = piece.usedLlm;
          tokensUsed = piece.tokensUsed;
        }
      }

      yield { type: 'done', citations, confidence };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.log.error(`Stream hỏng: ${detail}`);

      // Đã phát được một phần chữ thì giữ nguyên phần đó rồi nối câu xin lỗi —
      // xoá đi trước mắt khách còn khó hiểu hơn.
      full = full ? `${full}\n\n${SYSTEM_ERROR}` : SYSTEM_ERROR;
      citations = [];
      confidence = 0;
      usedLlm = false;

      yield { type: 'error', message: SYSTEM_ERROR };
    }

    // Ghi sổ SAU KHI stream xong. Không thể ghi sớm hơn vì lúc đó chưa có
    // câu trả lời hoàn chỉnh để lưu vào Message.content.
    await this.persist(conversation.id, {
      answer: full,
      citations,
      confidence,
      usedLlm,
      tokensUsed,
    });

    this.log.log(
      `chat(stream) conv=${conversation.id} history=${history.length} llm=${usedLlm} tokens=${tokensUsed}`,
    );
  }

  /** Lưu câu trả lời + usage + updatedAt trong một transaction. Dùng chung cho cả hai đường. */
  private async persist(conversationId: string, result: RagAnswer) {
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: result.answer,
          citations: result.citations,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
        } as any,
      }),
      ...(result.usedLlm
        ? [
            this.prisma.usageEvent.create({
              data: { type: 'AI_MESSAGE' } as any,
            }),
          ]
        : []),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
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
      const detail = err instanceof Error ? err.message : String(err);
      this.log.error(`Không trả lời được: ${detail}`);

      // Vẫn trả về một RagAnswer hợp lệ để luồng chính ghi Message như thường.
      // Không có nó thì hội thoại có câu hỏi mà thiếu hẳn câu trả lời.
      return {
        answer: SYSTEM_ERROR,
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

    return rows
      .slice(1) // bỏ chính câu hỏi vừa lưu, nó không phải "lịch sử"
      .reverse() // ...rồi đảo lại cho đúng thứ tự hội thoại
      .map((m) => ({ role: m.role, content: m.content }));
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
