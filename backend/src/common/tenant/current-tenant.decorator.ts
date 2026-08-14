import { createParamDecorator } from '@nestjs/common';
import { TenantContext } from './tenant.context';

export const CurrentTenant = createParamDecorator(() =>
  TenantContext.requireTenantId(),
);
