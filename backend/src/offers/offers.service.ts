import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfferProvider, Prisma } from '@prisma/client';
import { CacheService } from '../common/cache.service';

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getOffers(categorySlug?: string) {
    const cacheKey = this.cache.buildKey('offers', categorySlug || 'all');
    return this.cache.wrap(cacheKey, 300, async () => {
      const where: Prisma.OfferWhereInput = { status: true };
      if (categorySlug) {
        where.category = { slug: categorySlug };
      }
      return this.prisma.offer.findMany({
        where,
        orderBy: { rewardAmount: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true } },
        },
      });
    });
  }

  async getCategories() {
    return this.cache.wrap(this.cache.buildKey('categories'), 300, () =>
      this.prisma.offerCategory.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { offers: { where: { status: true } } } } },
      }),
    );
  }

  async getOfferById(id: string) {
    return this.cache.wrap(this.cache.buildKey('offer', id), 300, async () => {
      const offer = await this.prisma.offer.findUnique({
        where: { id },
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true } },
        },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      return offer;
    });
  }

  async invalidateOffersCache() {
    await this.cache.del(this.cache.buildKey('offers', 'all'));
  }
}
