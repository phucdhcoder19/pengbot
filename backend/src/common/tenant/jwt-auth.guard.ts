import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantContext } from './tenant.context';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(): boolean {
    const store = TenantContext.get();
    // Middleware đã verify JWT rồi; có userId nghĩa là token hợp lệ.
    // Request từ widget chỉ có tenantId (không userId) → cũng bị chặn ở đây, đúng ý.
    if (!store?.userId) throw new UnauthorizedException();
    return true;
  }
}
