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
/// Đặt WIDGET_DIR trong .env để trỏ đi chỗ khác lúc deploy.
const WIDGET_DIR =
  process.env.WIDGET_DIR ?? join(process.cwd(), '..', 'widget');

@Controller('public')
export class WidgetController {
  constructor(@Inject(PRISMA) private readonly prisma: ExtendedPrismaClient) {}

  /**
   * Phục vụ LOADER cho thẻ <script> trên website khách hàng.
   *
   * URL vẫn là widget.js (snippet đã phát cho khách không đổi), nhưng nội dung
   * giờ chỉ là loader ~2KB: vẽ bong bóng, và khi người dùng bấm mới nạp
   * widget-core.js. Xem widget/loader.js.
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
  widgetJs(): Promise<string> {
    return this.serveWidgetFile('loader.js');
  }

  /** Phần thân widget, chỉ được loader nạp khi người dùng bấm bong bóng. */
  @Get('widget-core.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  widgetCoreJs(): Promise<string> {
    return this.serveWidgetFile('core.js');
  }

  private async serveWidgetFile(name: string): Promise<string> {
    const file = join(WIDGET_DIR, name);
    try {
      return await readFile(file, 'utf8');
    } catch {
      throw new NotFoundException(`Không đọc được widget tại ${file}`);
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
