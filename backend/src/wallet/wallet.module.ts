import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { NotificationModule } from '../notification/notification.module';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [NotificationModule, FraudModule],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class WalletModule {}
