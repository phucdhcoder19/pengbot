import { AsyncLocalStorage } from 'node:async_hooks';
import type { Plan } from '../../../generated/prisma/enums';

export type TenantStore = {
  tenantId: string;
  userId?: string; // chỉ có ở request dashboard, request widget thì không
  /// Chỉ có ở request widget. Middleware đã phải nạp Tenant để tra publicKey
  /// nên lấy luôn, tránh guard phải truy vấn DB lần thứ hai.
  allowedDomains?: string[];
  /// Cũng chỉ có ở request widget, lấy cùng lượt truy vấn trên.
  /// ChatRateLimitGuard dùng để tra hạn mức (xem plan-limits.ts).
  plan?: Plan;
};

const als = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  run<T>(store: TenantStore, fn: () => T): T {
    return als.run(store, fn);
  },
  get(): TenantStore | undefined {
    return als.getStore();
  },
  getTenantId(): string | undefined {
    return als.getStore()?.tenantId;
  },
  requireTenantId(): string {
    const id = als.getStore()?.tenantId;
    if (!id) throw new Error('TenantContext chưa được thiết lập');
    return id;
  },
};
