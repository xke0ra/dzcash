import { Module } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { FraudController } from './fraud.controller';
import { FraudAnalyticsService } from './fraud-analytics.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [FraudService, FraudAnalyticsService],
  controllers: [FraudController],
  exports: [FraudService, FraudAnalyticsService],
})
export class FraudModule {}
