import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { PRISMA, type ExtendedPrismaClient } from '../../prisma/prisma';
import { TenantContext, TenantStore } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const store = await this.resolve(req);

    // Không xác định được tenant → vẫn cho đi tiếp, Guard sẽ chặn nếu route yêu cầu
    if (!store) return next();

    // Mọi thứ chạy sau next() đều nhìn thấy store này
    TenantContext.run(store, () => next());
  }

  private async resolve(req: Request): Promise<TenantStore | null> {
    // 1. Dashboard — Bearer token
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const p = await this.jwt.verifyAsync(auth.slice(7));
        return { tenantId: p.tenantId, userId: p.sub };
      } catch {
        return null; // token hỏng/hết hạn
      }
    }

    // 2. Widget — publicKey
    const key = (req.body?.publicKey ?? req.query?.key) as string | undefined;
    if (key) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { publicKey: key },
        select: { id: true, allowedDomains: true, plan: true },
      });
      if (tenant) {
        return {
          tenantId: tenant.id,
          allowedDomains: tenant.allowedDomains,
          plan: tenant.plan,
        };
      }
    }

    return null;
  }
}
