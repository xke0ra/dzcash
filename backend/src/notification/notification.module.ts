import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [NotificationService, PushService],
  controllers: [NotificationController, PushController],
  exports: [NotificationService, PushService],
})
export class NotificationModule {}
