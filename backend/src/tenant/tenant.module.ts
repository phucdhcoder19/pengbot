import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';

@Module({
  imports: [RateLimitModule], // QuotaService — dùng chung với guard chặn chat
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
