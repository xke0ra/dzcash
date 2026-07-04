import { Module } from '@nestjs/common';
import { TwofaService } from './twofa.service';
import { TwofaController } from './twofa.controller';

@Module({
  controllers: [TwofaController],
  providers: [TwofaService],
  exports: [TwofaService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TwofaModule {}
