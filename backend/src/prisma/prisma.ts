import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { TenantContext } from '../common/tenant/tenant.context';

/// Các model có cột tenantId. Tenant không nằm trong đây (nó CHÍNH LÀ tenant).
const TENANT_MODELS = new Set([
  'User',
  'Document',
  'Chunk',
  'Conversation',
  'Message',
  'UsageEvent',
]);

export function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = TenantContext.getTenantId();

          // Không có context (lúc register/login) hoặc model không thuộc tenant → chạy nguyên bản
          if (!tenantId || !TENANT_MODELS.has(model)) return query(args);

          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'update':
            case 'updateMany':
            case 'delete':
            case 'deleteMany':
              (args as any).where = { ...(args as any).where, tenantId };
              break;

            case 'create':
              (args as any).data = { ...(args as any).data, tenantId };
              break;

            case 'upsert':
              (args as any).where = { ...(args as any).where, tenantId };
              (args as any).create = { ...(args as any).create, tenantId };
              break;
          }

          return query(args);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
export const PRISMA = Symbol('PRISMA');
