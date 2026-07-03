import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ClickStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { OfferProviderInterface } from '../offers/providers/offer-provider.interface';
import { FraudService } from '../fraud/fraud.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class TrackingService {
  private providerMap: Map<string, OfferProviderInterface>;

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private fraudService: FraudService,
    private gamificationService: GamificationService,
    private allProviders: OfferProviderInterface[],
  ) {
    this.providerMap = new Map(
      this.allProviders.map((p) => [p.getProviderName().toUpperCase(), p]),
    );
  }

  async createClick(userId: string, offerId: string, ip: string, userAgent: string, deviceFingerprint?: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');

    const riskScore = await this.fraudService.calculateAndApplyRisk(userId, ip, deviceFingerprint);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && (user.status === 'SUSPENDED' || user.status === 'FROZEN')) {
      throw new BadRequestException('Action blocked due to high security risk score');
    }

    const click = await this.prisma.click.create({
      data: { userId, offerId, ip, userAgent, deviceFingerprint, status: ClickStatus.CLICKED },
    });

    const targetUrl = offer.targetUrl.replace('{click_id}', click.id);
    return { clickId: click.id, targetUrl };
  }

  async handlePostback(
    provider: string,
    query: Record<string, any>,
    headers: Record<string, any>,
    body: Record<string, any>,
    postbackIp: string = '127.0.0.1',
  ) {
    const cleanProvider = provider.toUpperCase();
    const providerAdapter = this.providerMap.get(cleanProvider);
    if (!providerAdapter) {
      throw new BadRequestException(`Unsupported offer provider: ${provider}`);
    }

    const isValid = await providerAdapter.validatePostback(query, headers, body);
    if (!isValid) throw new BadRequestException('Invalid signature');

    const data = providerAdapter.extractPostbackData(query, body);

    const initialClick = await this.prisma.click.findUnique({
      where: { id: data.clickId },
      include: { user: true },
    });
    if (!initialClick) throw new NotFoundException(`Click with ID ${data.clickId} not found`);

    await this.fraudService.checkGeoInconsistency(initialClick.userId, initialClick.id, postbackIp);
    await this.fraudService.calculateAndApplyRisk(initialClick.userId, postbackIp, initialClick.deviceFingerprint ?? undefined);

    const reloadedUser = await this.prisma.user.findUnique({ where: { id: initialClick.userId } });
    if (reloadedUser && reloadedUser.status === 'SUSPENDED') {
      throw new BadRequestException('Conversion rejected: user account is suspended');
    }

    const clickUserId = initialClick.userId;
    const referredById = initialClick.user.referredById;

    const result = await this.prisma.$transaction(async (tx) => {
      const click = await tx.click.findUnique({
        where: { id: data.clickId },
        include: {
          offer: true,
          user: { select: { id: true, referredById: true, status: true } },
        },
      });

      if (!click) throw new NotFoundException(`Click with ID ${data.clickId} not found`);
      if (click.status !== ClickStatus.CLICKED) {
        throw new ConflictException(`Click ${data.clickId} has already been processed (status: ${click.status})`);
      }

      await tx.click.update({ where: { id: data.clickId }, data: { status: ClickStatus.CONVERTED } });

      const reward = click.offer.rewardAmount;

      await tx.wallet.update({
        where: { userId: click.userId },
        data: { pendingBalance: { increment: reward } },
      });

      const userTx = await tx.transaction.create({
        data: {
          userId: click.userId,
          type: TransactionType.OFFER_CONVERSION,
          amount: reward,
          status: TransactionStatus.PENDING,
          clickId: click.id,
          notes: `Offer conversion: ${click.offer.name} (${cleanProvider})`,
        },
      });

      if (click.user.referredById) {
        const referralBonus = reward.mul(0.10);
        await tx.wallet.update({
          where: { userId: click.user.referredById },
          data: { availableBalance: { increment: referralBonus } },
        });
        await tx.transaction.create({
          data: {
            userId: click.user.referredById,
            type: TransactionType.REFERRAL_BONUS,
            amount: referralBonus,
            status: TransactionStatus.COMPLETED,
            notes: `Referral commission from user ${click.userId.substring(0, 8)}`,
          },
        });
      }

      return { success: true, transactionId: userTx.id, reward: reward.toNumber() };
    });

    this.gamificationService.handleOfferCompleted(clickUserId, data.clickId).catch((err) =>
      console.warn('Gamification: handleOfferCompleted failed', err.message),
    );

    if (referredById) {
      this.gamificationService.handleReferralBonus(referredById, clickUserId).catch((err) =>
        console.warn('Gamification: handleReferralBonus failed', err.message),
      );
    }

    return result;
  }
}
