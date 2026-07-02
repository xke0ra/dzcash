import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ClickStatus, OfferProvider, TransactionStatus, TransactionType } from '@prisma/client';
import { CpxProvider } from '../offers/providers/cpx.provider';
import { OfferToroProvider } from '../offers/providers/offertoro.provider';
import { GenericProvider } from '../offers/providers/generic.provider';
import { FraudService } from '../fraud/fraud.service';

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private cpxProvider: CpxProvider,
    private offerToroProvider: OfferToroProvider,
    private genericProvider: GenericProvider,
    private fraudService: FraudService,
  ) {}

  async createClick(userId: string, offerId: string, ip: string, userAgent: string, deviceFingerprint?: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    // Run Fraud Check on Click
    const riskScore = await this.fraudService.calculateAndApplyRisk(userId, ip, deviceFingerprint);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && (user.status === 'SUSPENDED' || user.status === 'FROZEN')) {
      throw new BadRequestException('Action blocked due to high security risk score');
    }

    // Generate Click record
    const click = await this.prisma.click.create({
      data: {
        userId,
        offerId,
        ip,
        userAgent,
        deviceFingerprint,
        status: ClickStatus.CLICKED,
      },
    });

    // Replace click_id placeholder in targetUrl
    const targetUrl = offer.targetUrl.replace('{click_id}', click.id);

    return {
      clickId: click.id,
      targetUrl,
    };
  }

  async handlePostback(
    provider: string,
    query: Record<string, any>,
    headers: Record<string, any>,
    body: Record<string, any>,
    postbackIp: string = '127.0.0.1',
  ) {
    // 1. Get the provider adapter
    let providerAdapter;
    const cleanProvider = provider.toUpperCase();

    if (cleanProvider === OfferProvider.CPX) {
      providerAdapter = this.cpxProvider;
    } else if (cleanProvider === OfferProvider.OFFERTORO) {
      providerAdapter = this.offerToroProvider;
    } else if (cleanProvider === OfferProvider.GENERIC) {
      providerAdapter = this.genericProvider;
    } else {
      throw new BadRequestException('Unsupported offer provider');
    }

    // 2. Validate signature
    const isValid = await providerAdapter.validatePostback(query, headers, body);
    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    // 3. Extract data
    const data = providerAdapter.extractPostbackData(query, body);

    // 4. Retrieve click history (outside transaction for quick validation)
    const initialClick = await this.prisma.click.findUnique({
      where: { id: data.clickId },
      include: { user: true },
    });

    if (!initialClick) {
      throw new NotFoundException(`Click with ID ${data.clickId} not found`);
    }

    // 5. Fraud checks on conversion postback
    await this.fraudService.checkGeoInconsistency(initialClick.userId, initialClick.id, postbackIp);
    await this.fraudService.calculateAndApplyRisk(initialClick.userId, postbackIp, initialClick.deviceFingerprint);

    const reloadedUser = await this.prisma.user.findUnique({
      where: { id: initialClick.userId },
    });

    if (reloadedUser && reloadedUser.status === 'SUSPENDED') {
      throw new BadRequestException('Conversion rejected: user account is suspended');
    }

    return this.prisma.$transaction(async (tx) => {
      const click = await tx.click.findUnique({
        where: { id: data.clickId },
        include: {
          offer: true,
          user: {
            select: {
              id: true,
              referredById: true,
              status: true,
            },
          },
        },
      });

      if (!click) {
        throw new NotFoundException(`Click with ID ${data.clickId} not found`);
      }

      if (click.status !== ClickStatus.CLICKED) {
        throw new ConflictException(`Click ${data.clickId} has already been processed (status: ${click.status})`);
      }

      // Update click status to CONVERTED
      await tx.click.update({
        where: { id: data.clickId },
        data: { status: ClickStatus.CONVERTED },
      });

      const reward = click.offer.rewardAmount;

      // Credit user's wallet (PENDING balance)
      await tx.wallet.update({
        where: { userId: click.userId },
        data: {
          pendingBalance: { increment: reward },
        },
      });

      // Create transaction for user
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

      // referral bonus logic (10% reward)
      if (click.user.referredById) {
        const referrerId = click.user.referredById;
        const referralBonus = reward.mul(0.10); // 10%

        await tx.wallet.update({
          where: { userId: referrerId },
          data: {
            availableBalance: { increment: referralBonus },
          },
        });

        await tx.transaction.create({
          data: {
            userId: referrerId,
            type: TransactionType.REFERRAL_BONUS,
            amount: referralBonus,
            status: TransactionStatus.COMPLETED,
            notes: `Referral commission from user signup ${click.userId.substring(0, 8)}`,
          },
        });
      }

      return {
        success: true,
        transactionId: userTx.id,
        reward: reward.toNumber(),
      };
    });
  }
}
