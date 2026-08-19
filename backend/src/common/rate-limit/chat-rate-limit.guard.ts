import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenantContext } from '../tenant/tenant.context';
import { RateLimitService } from './rate-limit.service';
import { QuotaService } from './quota.service';
import { limitsOf, monthStart, nextMonth } from './plan-limits';
import { clientIp, publicRules, tooManyRequestsBody } from './public-rules';

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
    private readonly quota: QuotaService,
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

    const verdict = await this.rateLimit.check(
      publicRules({
        prefix: 'chat',
        tenantId,
        visitorId,
        ip,
        perVisitor: VISITOR_PER_MIN,
        perIp: IP_PER_MIN,
        perTenant: limits.requestsPerMinute,
      }),
    );
    if (!verdict.allowed) {
      this.log.warn(
        `429 ${verdict.label} tenant=${tenantId} ip=${ip ?? '-'} visitor=${visitorId ?? '-'}`,
      );
      res.setHeader('Retry-After', String(verdict.retryAfterSec));
      throw new HttpException(
        tooManyRequestsBody(verdict.retryAfterSec),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.assertQuota(tenantId, limits.aiMessagesPerMonth);
    return true;
  }

  /**
   * Quota tháng. Con số "đã dùng" lấy từ QuotaService — CÙNG một hàm mà
   * dashboard gọi, nên hai nơi không thể lệch nhau.
   *
   * Không cache trong Redis: nguồn sự thật phải là bảng UsageEvent (thứ dùng
   * để tính tiền), và một counter Redis lệch pha với DB là loại lỗi rất khó tìm.
   */
  private async assertQuota(tenantId: string, monthlyLimit: number) {
    const used = await this.quota.usedThisMonth(tenantId);
    if (used < monthlyLimit) return;

    const from = monthStart();
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
