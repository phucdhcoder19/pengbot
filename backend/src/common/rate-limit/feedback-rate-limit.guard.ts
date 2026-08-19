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
import { clientIp, publicRules, tooManyRequestsBody } from './public-rules';

/// Rộng hơn nhiều so với trần của /public/chat: bấm 👍/👎 chỉ tốn một lệnh
/// UPDATE có index, không gọi LLM. Trần ở đây chỉ để chặn kịch bản bơm hàng
/// nghìn lượt chấm nhằm bóp méo số liệu của tenant, không phải để giữ tiền.
const VISITOR_PER_MIN = 20;
const IP_PER_MIN = 60;
const TENANT_PER_MIN = 300;

const ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';

/** Gác cho /public/feedback. Đặt SAU PublicWidgetGuard. */
@Injectable()
export class FeedbackRateLimitGuard implements CanActivate {
  private readonly log = new Logger(FeedbackRateLimitGuard.name);

  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!ENABLED) return true;

    const store = TenantContext.get();
    if (!store?.tenantId) return true; // PublicWidgetGuard đã lo

    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const ip = clientIp(req);
    const visitorId = (req.body as { visitorId?: string } | undefined)
      ?.visitorId;

    const verdict = await this.rateLimit.check(
      publicRules({
        // Tiền tố riêng: chấm điểm KHÔNG được ăn vào hạn mức chat. Khách bấm
        // 👍 vài lần rồi không hỏi tiếp được nữa thì vô lý.
        prefix: 'fb',
        tenantId: store.tenantId,
        visitorId,
        ip,
        perVisitor: VISITOR_PER_MIN,
        perIp: IP_PER_MIN,
        perTenant: TENANT_PER_MIN,
      }),
    );

    if (!verdict.allowed) {
      this.log.warn(
        `429 feedback/${verdict.label} tenant=${store.tenantId} ip=${ip ?? '-'}`,
      );
      res.setHeader('Retry-After', String(verdict.retryAfterSec));
      throw new HttpException(
        tooManyRequestsBody(verdict.retryAfterSec),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
