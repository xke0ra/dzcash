import { Module } from '@nestjs/common';
import { PushController } from './push.controller';

@Module({
  controllers: [PushController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PushModule {}
