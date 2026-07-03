import { Module } from '@nestjs/common';
import { TwofaService } from './twofa.service';
import { TwofaController } from './twofa.controller';

@Module({
  controllers: [TwofaController],
  providers: [TwofaService],
  exports: [TwofaService],
})
export class TwofaModule {}
