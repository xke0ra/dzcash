import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfferProvider } from '@prisma/client';

@Injectable()
export class OffersService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedMockOffers();
  }

  async seedMockOffers() {
    const count = await this.prisma.offer.count();
    if (count === 0) {
      const mockOffers = [
        {
          provider: OfferProvider.CPX,
          providerId: 'survey-101',
          name: 'CPX Quick Survey',
          description: 'Earn rewards by sharing your opinion on daily products. Takes ~5 minutes.',
          payoutAmount: 1.2000,
          rewardAmount: 0.9000,
          status: true,
          targetUrl: 'http://localhost:4000/api/offers/cpx/mock?click_id={click_id}',
        },
        {
          provider: OfferProvider.OFFERTORO,
          providerId: 'app-cpc-202',
          name: 'Coin Master Install',
          description: 'Download, install, and reach Village Level 3 to claim your rewards.',
          payoutAmount: 5.0000,
          rewardAmount: 3.7500,
          status: true,
          targetUrl: 'http://localhost:4000/api/offers/offertoro/mock?click_id={click_id}',
        },
        {
          provider: OfferProvider.GENERIC,
          providerId: 'generic-sign-303',
          name: 'Platform Newsletter Signup',
          description: 'Sign up for our weekly news bulletin with verified email.',
          payoutAmount: 0.5000,
          rewardAmount: 0.4000,
          status: true,
          targetUrl: 'http://localhost:4000/api/offers/generic/mock?click_id={click_id}',
        },
      ];

      for (const o of mockOffers) {
        await this.prisma.offer.create({
          data: o,
        });
      }
    }
  }

  async getOffers() {
    return this.prisma.offer.findMany({
      where: { status: true },
      orderBy: { rewardAmount: 'desc' },
    });
  }

  async getOfferById(id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }
}
