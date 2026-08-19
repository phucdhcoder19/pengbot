import { Inject, Injectable } from '@nestjs/common';
import type { Plan } from '../../../generated/prisma/enums';
import { PRISMA, type ExtendedPrismaClient } from '../../prisma/prisma';
import { limitsOf, monthStart, nextMonth } from './plan-limits';

export type QuotaStatus = {
  plan: Plan;
  /// Số câu trả lời có gọi LLM đã dùng trong tháng này.
  used: number;
  limit: number;
  /// Số còn lại, không bao giờ âm (trần có thể bị hạ khi tenant đổi gói).
  remaining: number;
  /// Mốc reset — đầu tháng sau theo UTC.
  resetAt: string;
};

/**
 * Quota theo tháng: nơi DUY NHẤT định nghĩa "đã dùng bao nhiêu".
 *
 * VÌ SAO LÀ SERVICE RIÊNG: hai chỗ cần con số này — ChatRateLimitGuard (để
 * chặn) và TenantService.usage() (để hiện lên dashboard). Chép câu đếm ra hai
 * nơi thì sớm muộn lệch nhau, và lúc đó khách thấy "87/100" trên dashboard
 * nhưng widget lại báo hết lượt. Loại lỗi đó rất khó tin và rất khó tìm.
 */
@Injectable()
export class QuotaService {
  constructor(@Inject(PRISMA) private readonly prisma: ExtendedPrismaClient) {}

  /**
   * Đếm UsageEvent AI_MESSAGE từ đầu tháng (UTC).
   *
   * Chỉ đếm câu CÓ gọi LLM — câu bị chốt chặn tin cậy từ chối không tạo
   * UsageEvent, nên không tính vào quota. Chạy trên @@index([tenantId, createdAt]).
   */
  usedThisMonth(tenantId: string): Promise<number> {
    return this.prisma.usageEvent.count({
      // Extension tự thêm tenantId, vẫn truyền tường minh để đọc câu này
      // không phải tin vào một extension ở file khác.
      where: { tenantId, type: 'AI_MESSAGE', createdAt: { gte: monthStart() } },
    });
  }

  /** Bức tranh đầy đủ cho dashboard. */
  async status(tenantId: string, plan: Plan): Promise<QuotaStatus> {
    const limit = limitsOf(plan).aiMessagesPerMonth;
    const used = await this.usedThisMonth(tenantId);

    return {
      plan,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: nextMonth(monthStart()).toISOString(),
    };
  }
}
