import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { OffersModule } from './offers/offers.module';
import { TrackingModule } from './tracking/tracking.module';
import { FraudModule } from './fraud/fraud.module';
import { EmailModule } from './email/email.module';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { AdminModule } from './admin/admin.module';
import { TwofaModule } from './twofa/twofa.module';
import { GamificationModule } from './gamification/gamification.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    WalletModule,
    OffersModule,
    TrackingModule,
    FraudModule,
    EmailModule,
    NotificationModule,
    HealthModule,
    MetricsModule,
    AdminModule,
    TwofaModule,
    GamificationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}