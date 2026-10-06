import { Logger } from '@nestjs/common';

/**
 * Redis là phụ trợ (rate limit + hàng đợi ingest) — nó chết thì app vẫn phải
 * sống. Free tier của nhà cung cấp còn tự xoá DB khi lâu không dùng, nên
 * "Redis biến mất" là chuyện bình thường chứ không phải sự cố hiếm.
 */

/// Reconnect giãn dần tới 30s thay vì mặc định ~2s — DNS hỏng thì thử dồn
/// dập cũng vô ích, chỉ đốt CPU và làm ngập log.
export const redisRetryStrategy = (times: number) =>
  Math.min(times * 1000, 30_000);

/**
 * Listener 'error' có giới hạn tần suất. Không gắn listener thì ioredis in
 * "[ioredis] Unhandled error event" ở MỖI lần reconnect hỏng; gắn rồi mà log
 * hết thì vẫn ngập. Mỗi phút log tối đa một dòng là đủ để biết Redis đang chết.
 */
export function throttledRedisErrorLogger(source: string, intervalMs = 60_000) {
  const log = new Logger(source);
  let lastAt = 0;
  let suppressed = 0;
  return (err: unknown) => {
    const now = Date.now();
    if (now - lastAt < intervalMs) {
      suppressed++;
      return;
    }
    const extra = suppressed ? ` (+${suppressed} lỗi tương tự bị ẩn)` : '';
    log.warn(
      `Redis lỗi: ${err instanceof Error ? err.message : String(err)}${extra}`,
    );
    lastAt = now;
    suppressed = 0;
  };
}

/// Promise.race với timeout — dùng cho lệnh Redis có thể treo vô hạn
/// (kết nối BullMQ đặt maxRetriesPerRequest: null nên tự nó không bao giờ bỏ cuộc).
export function withTimeout<T>(p: Promise<T>, ms: number, what: string) {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${what}: quá ${ms}ms không phản hồi`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
