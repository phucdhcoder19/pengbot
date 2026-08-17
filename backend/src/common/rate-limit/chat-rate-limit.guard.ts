import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PRISMA, type ExtendedPrismaClient } from '../../prisma/prisma';
import { TenantContext } from '../tenant/tenant.context';
import { RateLimitService, type Rule } from './rate-limit.service';
import { limitsOf, monthStart } from './plan-limits';

const MINUTE = 60_000;

/// Trần cho MỘT khách (visitorId trong localStorage của trình duyệt họ).
/// Chủ yếu chống bấm nhầm liên tục và script vụng; visitorId do client tự sinh
/// nên kẻ tấn công đổi được — hàng rào thật với họ là trần theo IP và theo tenant.
const VISITOR_PER_MIN = Number(process.env.RATE_LIMIT_VISITOR_PER_MIN ?? 8);

/// Trần cho một địa chỉ IP, cộng dồn mọi tenant. Rộng hơn trần visitor vì cả
/// một văn phòng có thể đi chung một IP qua NAT.
const IP_PER_MIN = Number(process.env.RATE_LIMIT_IP_PER_MIN ?? 30);

const ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';

/**
 * Gác cho /public/chat và /public/chat/stream.
 *
 * Đặt SAU PublicWidgetGuard (thứ tự trong @UseGuards): phải biết tenant là ai
 * mới tính được hạn mức, và không nên tốn một lượt Redis cho publicKey sai.
 *
 * Bốn tầng, kiểm từ rẻ tới đắt:
 *   1–3. sliding window trong Redis: visitor → IP → tenant   (một round-trip)
 *   4.   quota tháng: đếm UsageEvent trong Postgres
 */
@Injectable()
export class ChatRateLimitGuard implements CanActivate {
  private readonly log = new Logger(ChatRateLimitGuard.name);

  constructor(
    private readonly rateLimit: RateLimitService,
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!ENABLED) return true;

    const store = TenantContext.get();
    if (!store?.tenantId) return true; // PublicWidgetGuard đã lo, đây chỉ là lưới

    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const tenantId = store.tenantId;
    const limits = limitsOf(store.plan);
    const ip = clientIp(req);
    const visitorId = (req.body as { visitorId?: string } | undefined)
      ?.visitorId;

    const rules: Rule[] = [];
    if (visitorId) {
      // Gắn tenantId vào key: hai tenant tình cờ có visitorId trùng nhau
      // (localStorage bị chép, hoặc client sinh id kém ngẫu nhiên) thì không
      // ăn chung hạn mức của nhau.
      rules.push({
        key: `rl:v:${tenantId}:${visitorId}`,
        windowMs: MINUTE,
        limit: VISITOR_PER_MIN,
        label: 'visitor',
      });
    }
    if (ip) {
      rules.push({
        key: `rl:ip:${ip}`,
        windowMs: MINUTE,
        limit: IP_PER_MIN,
        label: 'ip',
      });
    }
    rules.push({
      key: `rl:t:${tenantId}`,
      windowMs: MINUTE,
      limit: limits.requestsPerMinute,
      label: 'tenant',
    });

    const verdict = await this.rateLimit.check(rules);
    if (!verdict.allowed) {
      this.log.warn(
        `429 ${verdict.label} tenant=${tenantId} ip=${ip ?? '-'} visitor=${visitorId ?? '-'}`,
      );
      res.setHeader('Retry-After', String(verdict.retryAfterSec));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'RATE_LIMITED',
          // Thông điệp đi thẳng ra widget, hiện trên website khách hàng →
          // viết cho người dùng cuối đọc, không lộ luật nào đã chặn.
          message: `Bạn đang gửi hơi nhanh. Vui lòng thử lại sau ${verdict.retryAfterSec} giây.`,
          retryAfterSec: verdict.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.assertQuota(tenantId, limits.aiMessagesPerMonth);
    return true;
  }

  /**
   * Quota tháng, đếm thẳng từ Postgres.
   *
   * Không cache trong Redis: nguồn sự thật phải là bảng UsageEvent (thứ dùng
   * để tính tiền), và một counter Redis lệch pha với DB là loại lỗi rất khó
   * tìm. Câu đếm này chạy trên index @@index([tenantId, createdAt]) nên với
   * vài nghìn dòng mỗi tháng là dưới một mili giây — rẻ hơn nhiều so với
   * phần còn lại của request (embed + LLM).
   *
   * Khi một tenant lên tới hàng trăm nghìn event/tháng thì đổi sang bảng tổng
   * hợp `UsageMonthly(tenantId, month, count)` cộng dồn lúc ghi.
   */
  private async assertQuota(tenantId: string, monthlyLimit: number) {
    const from = monthStart();

    // count đi qua Prisma extension → tự có WHERE tenantId. Vẫn truyền tường
    // minh để ai đọc câu này không phải tin vào một extension ở file khác.
    const used = await this.prisma.usageEvent.count({
      where: { tenantId, type: 'AI_MESSAGE', createdAt: { gte: from } },
    });

    if (used >= monthlyLimit) {
      this.log.warn(
        `429 quota tenant=${tenantId} used=${used}/${monthlyLimit} từ ${from.toISOString()}`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'QUOTA_EXCEEDED',
          message:
            'Trợ lý đã dùng hết lượt trả lời trong tháng này. Vui lòng liên hệ trực tiếp với chúng tôi.',
          used,
          limit: monthlyLimit,
          resetAt: nextMonth(from).toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

/**
 * IP của khách.
 *
 * `req.ip` chỉ đọc X-Forwarded-For khi Express bật `trust proxy` — main.ts
 * chỉ bật khi có biến TRUST_PROXY. Cố ý mặc định TẮT: tin header đó vô điều
 * kiện nghĩa là ai cũng tự khai IP của mình được, và trần theo IP thành vô dụng.
 */
function clientIp(req: Request): string | undefined {
  const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
  // ::ffff:1.2.3.4 (IPv4 bọc trong IPv6) → 1.2.3.4, để cùng một máy không
  // được tính thành hai IP khác nhau tuỳ cách kết nối.
  return ip?.replace(/^::ffff:/, '');
}

function nextMonth(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}
