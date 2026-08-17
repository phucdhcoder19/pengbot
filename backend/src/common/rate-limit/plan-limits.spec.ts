import { PLAN_LIMITS, limitsOf, monthStart } from './plan-limits';

describe('plan-limits', () => {
  it('mọi gói đều có hạn mức, và gói cao hơn thì rộng hơn', () => {
    expect(PLAN_LIMITS.FREE.aiMessagesPerMonth).toBeLessThan(
      PLAN_LIMITS.PRO.aiMessagesPerMonth,
    );
    expect(PLAN_LIMITS.PRO.aiMessagesPerMonth).toBeLessThan(
      PLAN_LIMITS.ENTERPRISE.aiMessagesPerMonth,
    );
    expect(PLAN_LIMITS.FREE.requestsPerMinute).toBeLessThan(
      PLAN_LIMITS.PRO.requestsPerMinute,
    );
  });

  it('gói không xác định → rơi về FREE, không phải undefined', () => {
    // Thêm giá trị mới vào enum Plan mà quên cập nhật map thì phải xuống mức
    // chặt nhất, tuyệt đối không được thành "không giới hạn".
    expect(limitsOf(undefined)).toBe(PLAN_LIMITS.FREE);
    expect(limitsOf('KHONG_TON_TAI' as never)).toBe(PLAN_LIMITS.FREE);
  });

  it('monthStart là 00:00 ngày 1 theo UTC', () => {
    const m = monthStart(new Date('2026-08-17T23:30:00Z'));
    expect(m.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('⭐ monthStart không phụ thuộc giờ địa phương của máy chủ', () => {
    // 2026-09-01T00:30Z là ngày 1 tháng 9 ở UTC, nhưng vẫn là 31/8 ở Mỹ.
    // Nếu dùng getMonth() thay getUTCMonth(), mốc sẽ nhảy lùi một tháng và
    // quota của khách bị cộng nhầm sang tháng cũ.
    const m = monthStart(new Date('2026-09-01T00:30:00Z'));
    expect(m.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});
