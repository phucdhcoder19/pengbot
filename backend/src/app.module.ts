import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { DocumentModule } from './documents/document.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { IngestModule } from './ingest/ingest.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }), // phải đứng ĐẦU — nạp .env trước
    AuthModule,
    PrismaModule,
    DocumentModule,
    IngestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
