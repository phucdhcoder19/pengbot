import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

/// Một luật cần kiểm. `key` đã gồm cả tiền tố định danh (tenant/ip/visitor).
export type Rule = {
  key: string;
  windowMs: number;
  limit: number;
  /// Tên hiển thị khi luật này chặn — dùng cho log, không gửi ra ngoài.
  label: string;
};

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSec: number; label: string };

/**
 * Sliding window log bằng Redis ZSET.
 *
 * Mỗi request là một phần tử trong ZSET với score = mốc thời gian (ms). Đếm
 * số phần tử còn nằm trong cửa sổ là ra số request gần đây.
 *
 * VÌ SAO KHÔNG DÙNG FIXED WINDOW (INCR + EXPIRE):
 * fixed window cho phép gấp đôi hạn mức ở ranh giới — 10 request lúc 10:00:59
 * và 10 request nữa lúc 10:01:00 là 20 request trong một giây, vẫn "đúng luật".
 * Với endpoint mỗi lượt tốn tới hai lời gọi LLM thì khe hở đó là tiền thật.
 *
 * Đánh đổi: tốn bộ nhớ hơn (một phần tử mỗi request thay vì một số đếm), và
 * cần Lua để thao tác nguyên khối. Với lưu lượng cỡ này thì không đáng kể.
 */
@Injectable()
export class RateLimitService {
  private readonly log = new Logger(RateLimitService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Kiểm TẤT CẢ các luật rồi mới ghi nhận, trong MỘT script Lua.
   *
   * Hai lượt (kiểm hết → ghi hết) chứ không kiểm-và-ghi từng luật: nếu luật
   * cuối chặn mà các luật trước đã ghi rồi thì request bị từ chối vẫn ăn mất
   * một suất của những luật kia — đếm sai và khách bị phạt oan.
   *
   * Lua chạy nguyên khối trong Redis nên hai lượt không bị request khác chen
   * vào giữa.
   */
  private static readonly SCRIPT = `
    local now = tonumber(ARGV[1])
    local member = ARGV[2]

    for i, key in ipairs(KEYS) do
      local window = tonumber(ARGV[1 + i * 2])
      local limit  = tonumber(ARGV[2 + i * 2])
      redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
      if redis.call('ZCARD', key) >= limit then
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local retry = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
        if retry < 1 then retry = 1 end
        return { i, retry }
      end
    end

    for i, key in ipairs(KEYS) do
      local window = tonumber(ARGV[1 + i * 2])
      redis.call('ZADD', key, now, member)
      redis.call('PEXPIRE', key, window)
    end

    return { 0, 0 }
  `;

  async check(rules: Rule[]): Promise<RateLimitResult> {
    if (!rules.length) return { allowed: true };

    const now = Date.now();
    // Member phải là duy nhất: hai request cùng mili giây mà trùng member thì
    // ZADD ghi đè, hoá ra chỉ đếm thành một.
    const args: (string | number)[] = [now, randomUUID()];
    for (const r of rules) args.push(r.windowMs, r.limit);

    try {
      const [blockedIndex, retryAfterSec] = (await this.redis.eval(
        RateLimitService.SCRIPT,
        rules.length,
        ...rules.map((r) => r.key),
        ...args,
      )) as [number, number];

      if (blockedIndex === 0) return { allowed: true };

      return {
        allowed: false,
        retryAfterSec,
        label: rules[blockedIndex - 1].label, // Lua đếm từ 1
      };
    } catch (err) {
      // ⭐ FAIL-OPEN. Redis chết thì cho request đi tiếp.
      // Lý do: rate limit là hàng rào chi phí, không phải hàng rào bảo mật.
      // Chặn hết khách vì một sự cố hạ tầng phụ trợ là đánh đổi tệ hơn nhiều
      // so với việc chịu rủi ro bị lạm dụng trong lúc Redis đang hỏng.
      // Quota tháng đếm từ Postgres nên vẫn còn nguyên tác dụng.
      this.log.warn(
        `Redis lỗi, bỏ qua rate limit: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { allowed: true };
    }
  }
}
