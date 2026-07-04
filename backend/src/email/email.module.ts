import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class EmailModule {}
