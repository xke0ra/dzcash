import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';

@Module({
  providers: [GamificationService],
  controllers: [GamificationController],
  exports: [GamificationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GamificationModule {}
