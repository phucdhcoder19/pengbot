import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../common/tenant/jwt-auth.guard';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get('me')
  me() {
    return this.tenant.me();
  }

  @Patch('tenant')
  update(@Body() dto: UpdateTenantDto) {
    return this.tenant.update(dto);
  }

  @Get('usage')
  usage(
    // Query string luôn là chuỗi. ParseIntPipe đổi sang số và trả 400 nếu
    // ai đó gửi ?days=abc — không có nó thì new Date(NaN) và SQL hỏng.
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.tenant.usage(Math.min(Math.max(days, 1), 365));
  }
}
