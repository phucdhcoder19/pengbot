import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  redisRetryStrategy,
  throttledRedisErrorLogger,
} from './redis-resilience';

export const REDIS = Symbol('REDIS');

/**
 * Client Redis dùng chung cho phần không phải hàng đợi (rate limit).
 *
 * BullMQ đã có kết nối riêng và KHÔNG dùng chung được: nó đặt
 * `maxRetriesPerRequest: null` để job không bao giờ bị bỏ giữa chừng, còn ở
 * đây ta muốn ngược lại — Redis chậm thì lỗi ngay để rate limit bỏ qua
 * (fail-open), chứ đừng treo request chat của khách.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false, // mất kết nối → ném lỗi ngay, không xếp hàng
          connectTimeout: 2000,
          retryStrategy: redisRetryStrategy,
        });
        // Không có listener này thì mỗi lần reconnect hỏng ioredis lại in
        // "Unhandled error event". Rate limit đã tự fail-open khi lệnh lỗi.
        redis.on('error', throttledRedisErrorLogger('RedisClient'));
        return redis;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /// Thiếu bước này thì jest treo sau khi test xong (socket còn mở).
  async onApplicationShutdown() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
