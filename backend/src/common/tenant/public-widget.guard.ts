import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantContext } from './tenant.context';

/**
 * Gác cho các route /public/*.
 *
 * Khác JwtAuthGuard ở chỗ: chỉ cần tenantId, KHÔNG cần userId — khách vào
 * website của công ty khách hàng thì không đăng nhập gì cả.
 */
@Injectable()
export class PublicWidgetGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const store = TenantContext.get();

    // Middleware không tra được publicKey → không xác định được công ty nào
    if (!store?.tenantId) {
      throw new UnauthorizedException('publicKey không hợp lệ');
    }

    const origin = ctx.switchToHttp().getRequest<Request>().headers.origin;
    const allowed = store.allowedDomains ?? [];

    // Chưa cấu hình domain nào → cho phép hết. Tenant mới tạo còn đang thử
    // nghiệm, chặn ngay sẽ làm họ không dùng được widget.
    if (!allowed.length) return true;

    // Không có header Origin = request không đến từ trình duyệt (curl,
    // server-to-server). Chặn ở đây KHÔNG có tác dụng bảo mật thật, vì kẻ tấn
    // công chỉ cần bỏ header đi. allowedDomains chỉ chặn được việc website
    // khác nhúng trộm publicKey của bạn — đó là điều nó làm được, và đủ.
    if (!origin) return true;

    const host = hostOf(origin);
    const ok = allowed.some((d) => host === d || host.endsWith(`.${d}`));
    if (!ok) {
      throw new ForbiddenException(`Domain ${origin} chưa được cho phép`);
    }

    return true;
  }
}

/// "https://sub.acme.com:443" → "sub.acme.com". Origin hỏng → chuỗi rỗng.
function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}
