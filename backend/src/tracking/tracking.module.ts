import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { WalletModule } from '../wallet/wallet.module';
import { OffersModule } from '../offers/offers.module';
import { FraudModule } from '../fraud/fraud.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [WalletModule, OffersModule, FraudModule, GamificationModule],
  providers: [TrackingService],
  controllers: [TrackingController],
  exports: [TrackingService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TrackingModule {}
