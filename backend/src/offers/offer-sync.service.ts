import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OfferProviderInterface, SyncResult } from './providers/offer-provider.interface';

@Injectable()
export class OfferSyncService {
  private readonly logger = new Logger(OfferSyncService.name);

  constructor(
    private prisma: PrismaService,
    private providers: OfferProviderInterface[],
  ) {}

  async onModuleInit() {
    await this.seedCategories();
  }

  private async seedCategories() {
    const count = await this.prisma.offerCategory.count();
    if (count === 0) {
      const categories = [
        { name: 'Survey', slug: 'survey', icon: '📋', sortOrder: 1 },
        { name: 'Video', slug: 'video', icon: '🎬', sortOrder: 2 },
        { name: 'Download', slug: 'download', icon: '⬇️', sortOrder: 3 },
        { name: 'Game', slug: 'game', icon: '🎮', sortOrder: 4 },
        { name: 'Signup', slug: 'signup', icon: '📝', sortOrder: 5 },
        { name: 'Shopping', slug: 'shopping', icon: '🛍️', sortOrder: 6 },
        { name: 'Finance', slug: 'finance', icon: '💰', sortOrder: 7 },
        { name: 'Health', slug: 'health', icon: '❤️', sortOrder: 8 },
        { name: 'Travel', slug: 'travel', icon: '✈️', sortOrder: 9 },
        { name: 'Social', slug: 'social', icon: '👥', sortOrder: 10 },
      ];
      for (const cat of categories) {
        await this.prisma.offerCategory.upsert({
          where: { slug: cat.slug },
          update: {},
          create: cat,
        });
      }
      this.logger.log('Seeded 10 offer categories');
    }
  }

  async syncAll(): Promise<Record<string, SyncResult>> {
    const results: Record<string, SyncResult> = {};

    for (const provider of this.providers) {
      try {
        results[provider.getProviderName()] = await this.syncProvider(provider);
      } catch (err: any) {
        this.logger.error(`Sync failed for ${provider.getProviderName()}: ${err.message}`);
        results[provider.getProviderName()] = { added: 0, updated: 0, removed: 0, errors: [err.message] };
      }
    }

    return results;
  }

  async syncProvider(provider: OfferProviderInterface): Promise<SyncResult> {
    const providerName = provider.getProviderName();
    const result: SyncResult = { added: 0, updated: 0, removed: 0, errors: [] };

    this.logger.log(`Starting sync for ${providerName}`);

    try {
      const remoteOffers = await provider.syncOffers();
      this.logger.log(`Fetched ${remoteOffers.length} offers from ${providerName}`);

      // Get all existing offers for this provider
      const existingOffers = await this.prisma.offer.findMany({
        where: { provider: providerName as any },
        select: { id: true, providerId: true },
      });
      const existingMap = new Map(existingOffers.map((o) => [o.providerId, o.id]));
      const remoteIds = new Set(remoteOffers.map((o) => o.providerId));

      // Get category slug -> id map
      const categories = await this.prisma.offerCategory.findMany();
      const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

      for (const remote of remoteOffers) {
        try {
          const categoryId = remote.category ? categoryMap.get(remote.category) : null;

          if (existingMap.has(remote.providerId)) {
            // Update existing
            await this.prisma.offer.update({
              where: { id: existingMap.get(remote.providerId) },
              data: {
                name: remote.name,
                description: remote.description,
                payoutAmount: remote.payoutAmount,
                rewardAmount: remote.rewardAmount,
                targetUrl: remote.targetUrl,
                imageUrl: remote.imageUrl,
                categoryId: categoryId,
                countries: remote.countries ? remote.countries : undefined,
                devices: remote.devices || undefined,
                requirements: remote.requirements,
                instructions: remote.instructions,
                providerMetadata: remote.providerMetadata || undefined,
                status: true,
              },
            });
            result.updated++;
          } else {
            // Create new
            await this.prisma.offer.create({
              data: {
                provider: providerName as any,
                providerId: remote.providerId,
                name: remote.name,
                description: remote.description,
                payoutAmount: remote.payoutAmount,
                rewardAmount: remote.rewardAmount,
                targetUrl: remote.targetUrl,
                imageUrl: remote.imageUrl,
                categoryId: categoryId,
                countries: remote.countries ? remote.countries : undefined,
                devices: remote.devices || undefined,
                requirements: remote.requirements,
                instructions: remote.instructions,
                providerMetadata: remote.providerMetadata || undefined,
                status: true,
              },
            });
            result.added++;
          }
        } catch (err: any) {
          result.errors.push(`Offer ${remote.providerId}: ${err.message}`);
        }
      }

      // Disable offers that no longer exist remotely
      for (const [providerId, offerId] of existingMap) {
        if (!remoteIds.has(providerId)) {
          await this.prisma.offer.update({
            where: { id: offerId },
            data: { status: false },
          });
          result.removed++;
        }
      }

      // Update sync metadata
      await this.prisma.syncMetadata.upsert({
        where: { provider: providerName as any },
        update: {
          lastSyncAt: new Date(),
          status: 'idle',
          offersFound: remoteOffers.length,
          offersAdded: result.added,
          offersUpdated: result.updated,
          offersRemoved: result.removed,
          errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        },
        create: {
          provider: providerName as any,
          lastSyncAt: new Date(),
          status: 'idle',
          offersFound: remoteOffers.length,
          offersAdded: result.added,
          offersUpdated: result.updated,
          offersRemoved: result.removed,
          errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        },
      });

      this.logger.log(`Sync complete for ${providerName}: +${result.added} ~${result.updated} -${result.removed} ${result.errors.length > 0 ? `(${result.errors.length} errors)` : ''}`);
    } catch (err: any) {
      result.errors.push(err.message);
      await this.prisma.syncMetadata.upsert({
        where: { provider: providerName as any },
        update: { status: 'error', errorMessage: err.message, lastSyncAt: new Date() },
        create: { provider: providerName as any, status: 'error', errorMessage: err.message, lastSyncAt: new Date() },
      });
    }

    return result;
  }

  @Cron('0 3 * * *')
  async dailySync() {
    this.logger.log('Starting daily scheduled offer sync');
    await this.syncAll();
  }

  async getSyncStatus() {
    return this.prisma.syncMetadata.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }
}
