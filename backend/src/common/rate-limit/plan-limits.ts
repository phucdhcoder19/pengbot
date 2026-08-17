import type { Plan } from '../../../generated/prisma/enums';

export type PlanLimits = {
  /// Trần số câu trả lời CÓ GỌI LLM trong một tháng dương lịch (UTC).
  /// Đếm theo UsageEvent type=AI_MESSAGE — câu "không có thông tin" do chốt
  /// chặn tin cậy chặn lại KHÔNG tính, vì nó không tốn token sinh câu trả lời.
  aiMessagesPerMonth: number;
  /// Trần số request chat mỗi phút cho TOÀN BỘ tenant. Đây là hàng rào chống
  /// đốt tiền: publicKey ai cũng đọc được, mất trần này thì một vòng lặp curl
  /// tiêu hết quota tháng của khách trong vài phút.
  requestsPerMinute: number;
};

/**
 * Hạn mức theo gói.
 *
 * Để trong code chứ không phải bảng DB: MVP chưa có Stripe, chưa cần cho phép
 * đổi hạn mức từng tenant. Khi gắn billing thì thêm bảng `Plan` và đọc từ đó,
 * giữ nguyên map này làm giá trị mặc định.
 *
 * ⚠️ requestsPerMinute tính MỌI request chat, kể cả câu bị từ chối trả lời.
 * Cố ý: câu bị từ chối vẫn tốn một lần embed (và một lần viết lại câu hỏi nếu
 * hội thoại có lịch sử) — vẫn là tiền thật.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { aiMessagesPerMonth: 100, requestsPerMinute: 10 },
  PRO: { aiMessagesPerMonth: 5_000, requestsPerMinute: 60 },
  ENTERPRISE: { aiMessagesPerMonth: 100_000, requestsPerMinute: 300 },
};

export function limitsOf(plan: Plan | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? 'FREE'] ?? PLAN_LIMITS.FREE;
}

/**
 * Mốc đầu tháng theo UTC.
 *
 * UTC chứ không phải giờ địa phương của server: đổi timezone máy chủ (hoặc
 * chuyển vùng deploy) mà làm quota nhảy lùi một tháng thì khách bị tính sai.
 */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
