import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PRISMA, type ExtendedPrismaClient } from '../prisma/prisma';
import { TenantContext } from '../common/tenant/tenant.context';
import { PublicWidgetGuard } from '../common/tenant/public-widget.guard';

/// widget/ nằm ngoài backend/ nên đường dẫn tính từ cwd (là backend/ khi chạy).
/// Đặt WIDGET_PATH trong .env để trỏ đi chỗ khác lúc deploy.
const WIDGET_FILE =
  process.env.WIDGET_PATH ?? join(process.cwd(), '..', 'widget', 'widget.js');

@Controller('public')
export class WidgetController {
  constructor(@Inject(PRISMA) private readonly prisma: ExtendedPrismaClient) {}

  /**
   * Phục vụ file widget.js cho thẻ <script> trên website khách hàng.
   *
   * KHÔNG gắn guard: publicKey nằm ở thuộc tính data-key của thẻ script,
   * trình duyệt không gửi nó khi tải file. File này giống hệt nhau cho mọi
   * tenant nên cũng chẳng có gì để bảo vệ.
   */
  @Get('widget.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  // 5 phút: đủ để không bị tải lại mỗi lần chuyển trang, đủ ngắn để sửa lỗi
  // không phải chờ khách xoá cache.
  @Header('Cache-Control', 'public, max-age=300')
  async widgetJs(): Promise<string> {
    try {
      return await readFile(WIDGET_FILE, 'utf8');
    } catch {
      throw new NotFoundException(`Không đọc được widget tại ${WIDGET_FILE}`);
    }
  }

  /**
   * Cấu hình giao diện của một tenant. Widget gọi ngay khi khởi động.
   *
   * CÓ gắn guard: tenant được xác định qua ?key=pk_... (TenantMiddleware đọc
   * req.query.key), và guard kiểm luôn Origin theo allowedDomains.
   */
  @Get('config')
  @UseGuards(PublicWidgetGuard)
  @Header('Cache-Control', 'no-store') // đổi màu trong dashboard phải thấy ngay
  async config(@Query('key') _key: string) {
    const tenant = await this.prisma.tenant.findUnique({
      // ⚠️ Tenant không nằm trong TENANT_MODELS → extension không lọc.
      // id lấy từ context (do middleware đặt), KHÔNG lấy từ query.
      where: { id: TenantContext.requireTenantId() },
      // Chỉ 3 trường giao diện. Tuyệt đối không lộ publicKey, plan, allowedDomains
      // — trang này ai cũng gọi được.
      select: {
        widgetTitle: true,
        widgetColor: true,
        widgetGreeting: true,
      },
    });

    if (!tenant) throw new NotFoundException();
    return tenant;
  }
}
