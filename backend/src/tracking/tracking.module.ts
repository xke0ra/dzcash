import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { WalletModule } from '../wallet/wallet.module';
import { OffersModule } from '../offers/offers.module';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [WalletModule, OffersModule, FraudModule],
  providers: [TrackingService],
  controllers: [TrackingController],
  exports: [TrackingService],
})
export class TrackingModule {}
