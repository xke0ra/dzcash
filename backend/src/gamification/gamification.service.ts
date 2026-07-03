import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpSource, LeaderboardPeriod, BadgeCategory } from '@prisma/client';

const XP_PER_OFFER = 50;
const XP_DAILY_LOGIN = 10;
const XP_STREAK_BONUS_PER_DAY = 5;
const XP_CHALLENGE_BONUS = 100;
const XP_REFERRAL_BONUS = 25;
const XP_WITHDRAWAL = 20;

const LEVELS = (() => {
  const levels: { level: number; xpRequired: number; title: string; reward: any }[] = [];
  for (let i = 1; i <= 100; i++) {
    const xpRequired = i <= 10 ? i * 100 : i <= 30 ? (i - 10) * 150 + 1000 : i <= 60 ? (i - 30) * 250 + 4000 : (i - 60) * 500 + 11500;
    const tier = i <= 10 ? 'Bronze' : i <= 30 ? 'Silver' : i <= 60 ? 'Gold' : i <= 85 ? 'Platinum' : 'Diamond';
    const num = i <= 10 ? i : i <= 30 ? i - 10 : i <= 60 ? i - 30 : i <= 85 ? i - 60 : i - 85;
    const title = `${tier} ${numToRoman(num)}`;
    const reward: any = {};
    if (i % 10 === 0) reward.bonusPercent = Math.floor(i / 10) * 2;
    if (i % 25 === 0) reward.withdrawalFeeDiscount = Math.min(50, Math.floor(i / 25) * 10);
    levels.push({ level: i, xpRequired, title, reward });
  }
  return levels;
})();

function numToRoman(n: number): string {
  const r = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return r[n - 1] || String(n);
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private prisma: PrismaService) {}

  getLevels() {
    return LEVELS;
  }

  async getUserXp(userId: string) {
    let xp = await this.prisma.userXp.findUnique({ where: { userId } });
    if (!xp) {
      xp = await this.prisma.userXp.create({ data: { userId } });
    }
    return xp;
  }

  async awardXp(userId: string, amount: number, source: XpSource, reference?: string, note?: string) {
    const xp = await this.getUserXp(userId);
    const newTotal = xp.totalXp + amount;

    await this.prisma.xpTransaction.create({
      data: { userId, amount, source, reference, note },
    });

    const newLevel = this.calculateLevel(newTotal);
    const leveledUp = newLevel > xp.level;

    await this.prisma.userXp.update({
      where: { userId },
      data: { totalXp: newTotal, level: newLevel },
    });

    if (leveledUp) {
      this.logger.log(`User ${userId} leveled up to ${newLevel}`);
      for (let l = xp.level + 1; l <= newLevel; l++) {
        await this.checkLevelBadge(userId, l);
      }
    }

    await this.checkBadges(userId, source);
    await this.updateLeaderboard(userId, source, amount);

    return { totalXp: newTotal, level: newLevel, leveledUp, xpGained: amount };
  }

  private calculateLevel(totalXp: number): number {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVELS[i].xpRequired) return LEVELS[i].level;
    }
    return 1;
  }

  async trackDailyLogin(userId: string) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let streak = await this.prisma.dailyStreak.findUnique({ where: { userId } });
    if (!streak) {
      streak = await this.prisma.dailyStreak.create({
        data: { userId, currentStreak: 1, longestStreak: 1, lastLoginDate: today },
      });
      await this.awardXp(userId, XP_DAILY_LOGIN, XpSource.DAILY_LOGIN, undefined, 'First daily login');
      return streak;
    }

    if (streak.lastLoginDate && this.isSameDay(streak.lastLoginDate, today)) {
      return streak;
    }

    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const isConsecutive = streak.lastLoginDate && this.isSameDay(streak.lastLoginDate, yesterday);

    const newStreak = isConsecutive ? streak.currentStreak + 1 : 1;
    const longestStreak = Math.max(streak.longestStreak, newStreak);

    await this.prisma.dailyStreak.update({
      where: { userId },
      data: { currentStreak: newStreak, longestStreak, lastLoginDate: today },
    });

    const streakBonus = Math.min(newStreak - 1, 30) * XP_STREAK_BONUS_PER_DAY;
    const totalXp = XP_DAILY_LOGIN + streakBonus;
    await this.awardXp(userId, totalXp, XpSource.DAILY_LOGIN, undefined, `Day ${newStreak} login streak`);

    if (newStreak > 1) {
      await this.awardXp(userId, streakBonus, XpSource.STREAK_BONUS, undefined, `Streak bonus day ${newStreak}`);
    }

    await this.checkStreakBadges(userId, newStreak, longestStreak);

    return { currentStreak: newStreak, longestStreak, xpEarned: totalXp };
  }

  async handleOfferCompleted(userId: string, offerId: string) {
    await this.awardXp(userId, XP_PER_OFFER, XpSource.OFFER_COMPLETED, offerId, 'Offer completed');
    await this.updateChallengeProgress(userId, 'offer_count', 1);
  }

  async handleWithdrawalCompleted(userId: string, withdrawalId: string) {
    await this.awardXp(userId, XP_WITHDRAWAL, XpSource.WITHDRAWAL_COMPLETED, withdrawalId, 'Withdrawal completed');
  }

  async handleReferralBonus(userId: string, referralId: string) {
    await this.awardXp(userId, XP_REFERRAL_BONUS, XpSource.REFERRAL_BONUS, referralId, 'Referral bonus');
  }

  async getBadges(userId: string) {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { badge: { order: 'asc' } },
    });
    const allBadges = await this.prisma.badge.findMany({ orderBy: { order: 'asc' } });

    return allBadges.map((badge) => {
      const ub = userBadges.find((b) => b.badgeId === badge.id);
      return { ...badge, earned: !!ub, earnedAt: ub?.createdAt || null };
    });
  }

  async getLeaderboard(period: LeaderboardPeriod, limit = 50) {
    const entries = await this.prisma.leaderboardEntry.findMany({
      where: { period },
      orderBy: { score: 'desc' },
      take: limit,
      include: { user: { select: { id: true, email: true } } },
    });
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  }

  async getActiveChallenges(userId: string) {
    const now = new Date();
    const challenges = await this.prisma.challenge.findMany({
      where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
    });
    const userChallenges = await this.prisma.userChallenge.findMany({
      where: { userId, challengeId: { in: challenges.map((c) => c.id) } },
    });

    return challenges.map((c) => {
      const uc = userChallenges.find((u) => u.challengeId === c.id);
      return {
        ...c,
        progress: uc?.progress || 0,
        completed: uc?.completed || false,
        rewardClaimed: uc?.rewardClaimed || false,
      };
    });
  }

  async claimChallengeReward(userId: string, challengeId: string) {
    const uc = await this.prisma.userChallenge.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
      include: { challenge: true },
    });
    if (!uc || !uc.completed || uc.rewardClaimed) {
      return { success: false, message: 'Challenge not completed or already claimed' };
    }

    await this.prisma.userChallenge.update({
      where: { userId_challengeId: { userId, challengeId } },
      data: { rewardClaimed: true },
    });

    if (uc.challenge.xpReward > 0) {
      await this.awardXp(userId, uc.challenge.xpReward, XpSource.CHALLENGE_COMPLETED, challengeId, 'Challenge reward');
    }

    if (Number(uc.challenge.bonusAmount) > 0) {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (wallet) {
        await this.prisma.wallet.update({
          where: { userId },
          data: { availableBalance: { increment: uc.challenge.bonusAmount } },
        });
        await this.prisma.transaction.create({
          data: {
            userId,
            type: 'CHALLENGE_BONUS' as any,
            amount: uc.challenge.bonusAmount,
            status: 'COMPLETED',
            notes: `Challenge: ${uc.challenge.name}`,
          },
        });
      }
    }

    return { success: true };
  }

  private async checkBadges(userId: string, source: XpSource) {
    const xp = await this.getUserXp(userId);
    const totalOffers = await this.prisma.click.count({ where: { userId, status: 'CONVERTED' } });
    const totalWithdrawals = await this.prisma.withdrawal.count({ where: { userId, status: 'APPROVED' } });
    const streak = await this.prisma.dailyStreak.findUnique({ where: { userId } });
    const referralCount = await this.prisma.user.count({ where: { referredById: userId } });

    const checks: { key: string; earned: boolean }[] = [
      { key: 'first_offer', earned: totalOffers >= 1 },
      { key: 'ten_offers', earned: totalOffers >= 10 },
      { key: 'fifty_offers', earned: totalOffers >= 50 },
      { key: 'hundred_offers', earned: totalOffers >= 100 },
      { key: 'first_withdrawal', earned: totalWithdrawals >= 1 },
      { key: 'five_withdrawals', earned: totalWithdrawals >= 5 },
      { key: 'first_referral', earned: referralCount >= 1 },
      { key: 'ten_referrals', earned: referralCount >= 10 },
      { key: 'level_10', earned: xp.level >= 10 },
      { key: 'level_25', earned: xp.level >= 25 },
      { key: 'level_50', earned: xp.level >= 50 },
      { key: 'level_100', earned: xp.level >= 100 },
    ];

    if (streak) {
      checks.push(
        { key: 'streak_3', earned: streak.currentStreak >= 3 },
        { key: 'streak_7', earned: streak.currentStreak >= 7 },
        { key: 'streak_30', earned: streak.currentStreak >= 30 },
        { key: 'streak_365', earned: streak.currentStreak >= 365 },
      );
    }

    for (const check of checks) {
      if (check.earned) {
        await this.earnBadge(userId, check.key);
      }
    }
  }

  private async checkLevelBadge(userId: string, level: number) {
    const badgeKey = `level_${level}`;
    await this.earnBadge(userId, badgeKey);
  }

  private async checkStreakBadges(userId: string, currentStreak: number, longestStreak: number) {
    const thresholds = [3, 7, 30, 365];
    for (const t of thresholds) {
      if (longestStreak >= t) {
        await this.earnBadge(userId, `streak_${t}`);
      }
    }
  }

  private async earnBadge(userId: string, badgeKey: string) {
    const badge = await this.prisma.badge.findUnique({ where: { key: badgeKey } });
    if (!badge) return;

    const existing = await this.prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });
    if (existing) return;

    await this.prisma.userBadge.create({ data: { userId, badgeId: badge.id } });

    if (badge.xpReward > 0) {
      await this.awardXp(userId, badge.xpReward, XpSource.BADGE_EARNED, badge.id, `Badge: ${badge.name}`);
    }

    this.logger.log(`User ${userId} earned badge: ${badgeKey}`);
  }

  private async updateChallengeProgress(userId: string, type: string, amount: number) {
    const now = new Date();
    const challenges = await this.prisma.challenge.findMany({
      where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
    });

    for (const challenge of challenges) {
      const criteria = challenge.criteria as any;
      if (criteria.type !== type) continue;

      let uc = await this.prisma.userChallenge.findUnique({
        where: { userId_challengeId: { userId, challengeId: challenge.id } },
      });

      if (!uc) {
        uc = await this.prisma.userChallenge.create({
          data: { userId, challengeId: challenge.id, progress: 0 },
        });
      }

      if (uc.completed) continue;

      const newProgress = uc.progress + amount;
      const completed = newProgress >= criteria.threshold;

      await this.prisma.userChallenge.update({
        where: { userId_challengeId: { userId, challengeId: challenge.id } },
        data: { progress: newProgress, completed },
      });
    }
  }

  private async updateLeaderboard(userId: string, source: XpSource, amount: number) {
    if (source === XpSource.ADMIN_ADJUSTMENT) return;

    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(day);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const upsert = async (period: LeaderboardPeriod, since: Date) => {
      const totalXp = await this.getTotalXpSince(userId, since);
      await this.prisma.leaderboardEntry.upsert({
        where: { userId_period: { userId, period } },
        update: { score: totalXp },
        create: { userId, period, score: totalXp },
      });
    };

    await Promise.all([
      upsert(LeaderboardPeriod.DAILY, day),
      upsert(LeaderboardPeriod.WEEKLY, weekStart),
      upsert(LeaderboardPeriod.MONTHLY, monthStart),
    ]);
  }

  private async getTotalXpSince(userId: string, since: Date): Promise<number> {
    const result = await this.prisma.xpTransaction.aggregate({
      where: { userId, createdAt: { gte: since }, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    return result._sum.amount || 0;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  }

  async seedLevels() {
    for (const level of LEVELS) {
      await this.prisma.xpLevel.upsert({
        where: { level: level.level },
        update: level,
        create: level,
      });
    }
    this.logger.log(`Seeded ${LEVELS.length} XP levels`);
  }

  async seedBadges() {
    const badges: { key: string; name: string; description: string; category: BadgeCategory; criteria: any; xpReward: number; order: number }[] = [
      { key: 'first_offer', name: 'First Steps', description: 'Complete your first offer', category: BadgeCategory.OFFERS, criteria: { type: 'offer_count', threshold: 1 }, xpReward: 25, order: 1 },
      { key: 'ten_offers', name: 'Getting Started', description: 'Complete 10 offers', category: BadgeCategory.OFFERS, criteria: { type: 'offer_count', threshold: 10 }, xpReward: 50, order: 2 },
      { key: 'fifty_offers', name: 'Offer Machine', description: 'Complete 50 offers', category: BadgeCategory.OFFERS, criteria: { type: 'offer_count', threshold: 50 }, xpReward: 150, order: 3 },
      { key: 'hundred_offers', name: 'Offer Master', description: 'Complete 100 offers', category: BadgeCategory.OFFERS, criteria: { type: 'offer_count', threshold: 100 }, xpReward: 300, order: 4 },
      { key: 'first_withdrawal', name: 'Cash Out', description: 'Complete your first withdrawal', category: BadgeCategory.WITHDRAWALS, criteria: { type: 'withdrawal_count', threshold: 1 }, xpReward: 25, order: 5 },
      { key: 'five_withdrawals', name: 'Regular Withdrawer', description: 'Complete 5 withdrawals', category: BadgeCategory.WITHDRAWALS, criteria: { type: 'withdrawal_count', threshold: 5 }, xpReward: 75, order: 6 },
      { key: 'first_referral', name: 'Social Butterfly', description: 'Refer your first friend', category: BadgeCategory.REFERRALS, criteria: { type: 'referral_count', threshold: 1 }, xpReward: 50, order: 7 },
      { key: 'ten_referrals', name: 'Influencer', description: 'Refer 10 friends', category: BadgeCategory.REFERRALS, criteria: { type: 'referral_count', threshold: 10 }, xpReward: 200, order: 8 },
      { key: 'streak_3', name: 'Hat Trick', description: 'Log in for 3 consecutive days', category: BadgeCategory.STREAKS, criteria: { type: 'streak', threshold: 3 }, xpReward: 30, order: 9 },
      { key: 'streak_7', name: 'Full Week', description: 'Log in for 7 consecutive days', category: BadgeCategory.STREAKS, criteria: { type: 'streak', threshold: 7 }, xpReward: 75, order: 10 },
      { key: 'streak_30', name: 'Dedicated', description: 'Log in for 30 consecutive days', category: BadgeCategory.STREAKS, criteria: { type: 'streak', threshold: 30 }, xpReward: 300, order: 11 },
      { key: 'streak_365', name: 'Loyal Veteran', description: 'Log in for 365 consecutive days', category: BadgeCategory.STREAKS, criteria: { type: 'streak', threshold: 365 }, xpReward: 2000, order: 12 },
      { key: 'level_10', name: 'Bronze Star', description: 'Reach level 10', category: BadgeCategory.LEVELS, criteria: { type: 'level', threshold: 10 }, xpReward: 50, order: 13 },
      { key: 'level_25', name: 'Silver Star', description: 'Reach level 25', category: BadgeCategory.LEVELS, criteria: { type: 'level', threshold: 25 }, xpReward: 150, order: 14 },
      { key: 'level_50', name: 'Gold Star', description: 'Reach level 50', category: BadgeCategory.LEVELS, criteria: { type: 'level', threshold: 50 }, xpReward: 500, order: 15 },
      { key: 'level_100', name: 'Diamond Legend', description: 'Reach level 100', category: BadgeCategory.LEVELS, criteria: { type: 'level', threshold: 100 }, xpReward: 2000, order: 16 },
    ];

    for (const badge of badges) {
      await this.prisma.badge.upsert({
        where: { key: badge.key },
        update: { name: badge.name, description: badge.description, category: badge.category, criteria: badge.criteria as any, xpReward: badge.xpReward, order: badge.order },
        create: { key: badge.key, name: badge.name, description: badge.description, category: badge.category, criteria: badge.criteria as any, xpReward: badge.xpReward, order: badge.order },
      });
    }
    this.logger.log(`Seeded ${badges.length} badges`);
  }
}
