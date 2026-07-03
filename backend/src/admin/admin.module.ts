import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { WalletModule } from '../wallet/wallet.module';
import { OffersModule } from '../offers/offers.module';
import { FraudModule } from '../fraud/fraud.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [WalletModule, OffersModule, FraudModule, NotificationModule],
  providers: [AdminService, AdminGuard],
  controllers: [AdminController],
  exports: [AdminService, AdminGuard],
})
export class AdminModule {}

export { AdminGuard };