import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';

@Module({
  providers: [HealthService],
  controllers: [HealthController],
  exports: [HealthService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class HealthModule {}
