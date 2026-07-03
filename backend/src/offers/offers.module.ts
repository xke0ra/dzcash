import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { OfferSyncService } from './offer-sync.service';
import { CpxProvider } from './providers/cpx.provider';
import { OfferToroProvider } from './providers/offertoro.provider';
import { GenericProvider } from './providers/generic.provider';
import { AdgateMediaProvider } from './providers/adgatemedia.provider';
import { KiwiWallProvider } from './providers/kiwiwall.provider';
import { PersonaProvider } from './providers/persona.provider';
import { RevShareProvider } from './providers/revshare.provider';
import { MonetizerProvider } from './providers/monetizer.provider';
import { OfferFloodProvider } from './providers/offerflood.provider';
import { AdWallProvider } from './providers/adwall.provider';
import { TimeWallProvider } from './providers/timewall.provider';
import { SurveySpotProvider } from './providers/surveyspot.provider';
import { OfferEngineProvider } from './providers/offerengine.provider';
import { AdWorksHubProvider } from './providers/adworkshub.provider';
import { RevenueUnitProvider } from './providers/revenueunit.provider';
import { OfferYeProvider } from './providers/offerye.provider';
import { MonetagProvider } from './providers/monetag.provider';

const ALL_PROVIDERS = [
  CpxProvider,
  OfferToroProvider,
  GenericProvider,
  AdgateMediaProvider,
  KiwiWallProvider,
  PersonaProvider,
  RevShareProvider,
  MonetizerProvider,
  OfferFloodProvider,
  AdWallProvider,
  TimeWallProvider,
  SurveySpotProvider,
  OfferEngineProvider,
  AdWorksHubProvider,
  RevenueUnitProvider,
  OfferYeProvider,
  MonetagProvider,
];

@Module({
  providers: [
    OffersService,
    OfferSyncService,
    ...ALL_PROVIDERS,
  ],
  controllers: [OffersController],
  exports: [
    OffersService,
    OfferSyncService,
    ...ALL_PROVIDERS,
  ],
})
export class OffersModule {}
