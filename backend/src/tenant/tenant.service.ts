import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';
import { TenantContext } from '../common/tenant/tenant.context';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import { QuotaService } from '../common/rate-limit/quota.service';

/// Các trường của Tenant được phép lộ ra dashboard.
/// Viết tường minh để sau này thêm cột nhạy cảm vào schema không bị rò ra ngoài.
const TENANT_FIELDS = {
  id: true,
  name: true,
  slug: true,
  publicKey: true,
  plan: true,
  allowedDomains: true,
  widgetTitle: true,
  widgetColor: true,
  widgetGreeting: true,
} as const;

@Injectable()
export class TenantService {
  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    private readonly quota: QuotaService,
  ) {}

  async me() {
    const store = TenantContext.get();
    if (!store?.userId) throw new UnauthorizedException();

    const [user, tenant] = await Promise.all([
      // User NẰM TRONG TENANT_MODELS → extension tự thêm tenantId
      this.prisma.user.findFirst({
        where: { id: store.userId },
        select: { id: true, email: true, role: true },
      }),
      // ⚠️ Tenant KHÔNG nằm trong TENANT_MODELS → extension không lọc gì.
      // Phải tự tay truyền id. Quên là trả về tenant của người khác.
      this.prisma.tenant.findUnique({
        where: { id: store.tenantId },
        select: TENANT_FIELDS,
      }),
    ]);

    if (!user || !tenant) throw new UnauthorizedException();
    return { user, tenant };
  }

  update(dto: UpdateTenantDto) {
    // ⚠️ Cũng vậy: id phải lấy từ context, TUYỆT ĐỐI không nhận từ body.
    return this.prisma.tenant.update({
      where: { id: TenantContext.requireTenantId() },
      data: dto,
      select: TENANT_FIELDS,
    });
  }

  async usage(days = 30) {
    const tenantId = TenantContext.requireTenantId();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Gói nằm ở Tenant, mà TenantContext của request dashboard chỉ có tenantId
    // và userId (plan chỉ được nạp cho request widget) → phải tra thêm.
    // ⚠️ Tenant KHÔNG nằm trong TENANT_MODELS → extension không lọc, tự truyền id.
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true },
    });

    // Ba số tổng đi qua Prisma thường → extension tự lọc tenant
    const [totalMessages, totalDocuments, totalChunks] = await Promise.all([
      this.prisma.usageEvent.count({ where: { type: 'AI_MESSAGE' } }),
      this.prisma.document.count(),
      this.prisma.chunk.count(),
    ]);

    // Gộp theo NGÀY thì Prisma groupBy không làm được (nó chỉ gộp theo giá trị
    // nguyên vẹn của cột, không cắt được phần giờ) → phải raw SQL.
    //
    // ⚠️ Và raw SQL KHÔNG đi qua extension → "tenantId" phải tự viết.
    // ⚠️ count(*) của Postgres trả về bigint, Prisma map thành BigInt của JS,
    //    mà JSON.stringify ném lỗi với BigInt → ép ::int ngay trong SQL.
    const daily = await this.prisma.$queryRaw<
      { date: Date; aiMessages: number }[]
    >`
      SELECT date_trunc('day', "createdAt")::date AS date,
             count(*)::int AS "aiMessages"
      FROM "UsageEvent"
      WHERE "tenantId" = ${tenantId}
        AND type = 'AI_MESSAGE'
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;

    return {
      totalMessages,
      totalDocuments,
      totalChunks,
      daily,
      // ⚠️ KHÁC totalMessages: quota tính theo THÁNG DƯƠNG LỊCH (UTC) và so
      // với trần của gói, còn totalMessages là tổng trong `days` ngày trượt.
      // Đây chính là con số ChatRateLimitGuard dùng để chặn — cùng một hàm,
      // nên dashboard không thể hiện khác thứ widget đang thấy.
      quota: await this.quota.status(tenantId, tenant.plan),
    };
  }
}
