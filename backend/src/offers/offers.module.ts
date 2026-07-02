import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { CpxProvider } from './providers/cpx.provider';
import { OfferToroProvider } from './providers/offertoro.provider';
import { GenericProvider } from './providers/generic.provider';

@Module({
  providers: [
    OffersService,
    CpxProvider,
    OfferToroProvider,
    GenericProvider,
  ],
  controllers: [OffersController],
  exports: [
    OffersService,
    CpxProvider,
    OfferToroProvider,
    GenericProvider,
  ],
})
export class OffersModule {}
