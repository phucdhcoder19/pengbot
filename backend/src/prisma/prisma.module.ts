import { Global, Module } from '@nestjs/common';
import { PRISMA, createPrismaClient } from './prisma';

@Global()
@Module({
  providers: [{ provide: PRISMA, useFactory: createPrismaClient }],
  exports: [PRISMA],
})
export class PrismaModule {}
