import type { Request } from 'express';
import type { Rule } from './rate-limit.service';

export const MINUTE = 60_000;

/**
 * Dựng luật sliding window cho một endpoint công khai.
 *
 * Tách riêng vì có hai endpoint cần: /public/chat (đắt — tới hai lời gọi LLM)
 * và /public/feedback (rẻ — một lệnh UPDATE). Cùng cách nhận diện khách, khác
 * con số, nên chia sẻ hàm dựng chứ không chia sẻ hằng số.
 *
 * Thứ tự có ý nghĩa: luật hẹp nhất đứng trước, để thông báo trả về nói đúng
 * lý do thật (khách này gửi nhanh quá) thay vì lý do chung chung (cả tenant).
 */
export function publicRules(opts: {
  prefix: string;
  tenantId: string;
  visitorId?: string;
  ip?: string;
  perVisitor: number;
  perIp: number;
  perTenant: number;
}): Rule[] {
  const { prefix, tenantId, visitorId, ip } = opts;
  const rules: Rule[] = [];

  if (visitorId) {
    // Gắn tenantId vào key: hai tenant tình cờ có visitorId trùng nhau
    // (localStorage bị chép, hoặc client sinh id kém ngẫu nhiên) thì không
    // ăn chung hạn mức của nhau.
    rules.push({
      key: `rl:${prefix}:v:${tenantId}:${visitorId}`,
      windowMs: MINUTE,
      limit: opts.perVisitor,
      label: 'visitor',
    });
  }
  if (ip) {
    rules.push({
      key: `rl:${prefix}:ip:${ip}`,
      windowMs: MINUTE,
      limit: opts.perIp,
      label: 'ip',
    });
  }
  rules.push({
    key: `rl:${prefix}:t:${tenantId}`,
    windowMs: MINUTE,
    limit: opts.perTenant,
    label: 'tenant',
  });

  return rules;
}

/**
 * IP của khách.
 *
 * `req.ip` chỉ đọc X-Forwarded-For khi Express bật `trust proxy` — main.ts
 * chỉ bật khi có biến TRUST_PROXY. Cố ý mặc định TẮT: tin header đó vô điều
 * kiện nghĩa là ai cũng tự khai IP của mình được, và trần theo IP thành vô dụng.
 */
export function clientIp(req: Request): string | undefined {
  const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
  // ::ffff:1.2.3.4 (IPv4 bọc trong IPv6) → 1.2.3.4, để cùng một máy không
  // được tính thành hai IP khác nhau tuỳ cách kết nối.
  return ip?.replace(/^::ffff:/, '');
}

/** Body dùng chung của mọi 429 gửi ra widget. */
export function tooManyRequestsBody(retryAfterSec: number) {
  return {
    statusCode: 429,
    code: 'RATE_LIMITED' as const,
    // Thông điệp đi thẳng ra widget, hiện trên website khách hàng →
    // viết cho người dùng cuối đọc, không lộ luật nào đã chặn.
    message: `Bạn đang gửi hơi nhanh. Vui lòng thử lại sau ${retryAfterSec} giây.`,
    retryAfterSec,
  };
}
