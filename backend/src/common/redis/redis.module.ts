import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false, // mất kết nối → ném lỗi ngay, không xếp hàng
          connectTimeout: 2000,
        }),
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
