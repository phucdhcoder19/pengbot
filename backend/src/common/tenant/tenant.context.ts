import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStore = {
  tenantId: string;
  userId?: string; // chỉ có ở request dashboard, request widget thì không
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
