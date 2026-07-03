import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FraudAnalyticsService {
  private readonly logger = new Logger(FraudAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async recordFeedback(ruleId: string, sustained: boolean) {
    const rule = await this.prisma.fraudRule.findUnique({ where: { id: ruleId } });
    if (!rule) return;

    const data: any = {};
    if (sustained) {
      data.sustainedCount = { increment: 1 };
    } else {
      data.dismissedCount = { increment: 1 };
    }
    data.totalTriggers = { increment: 1 };

    const updated = await this.prisma.fraudRule.update({
      where: { id: ruleId },
      data,
    });

    const total = updated.totalTriggers;
    const sustainedTotal = updated.sustainedCount;
    const precision = total > 0 ? sustainedTotal / total : 0;
    const oldPrecision = updated.currentPrecision;

    await this.prisma.fraudRule.update({
      where: { id: ruleId },
      data: { currentPrecision: precision },
    });

    if (total >= 5 && Math.abs(precision - oldPrecision) > 0.1) {
      await this.adjustRuleWeight(ruleId, precision);
    }
  }

  private async adjustRuleWeight(ruleId: string, precision: number) {
    const rule = await this.prisma.fraudRule.findUnique({ where: { id: ruleId } });
    if (!rule || !rule.lastWeightAdjustment) return;

    const hoursSinceLastAdjust = (Date.now() - rule.lastWeightAdjustment.getTime()) / 3600000;
    if (hoursSinceLastAdjust < 24) return;

    let newWeight = rule.weight;
    if (precision >= 0.7) {
      newWeight = Math.min(rule.weight + 5, 100);
    } else if (precision <= 0.3 && rule.totalTriggers >= 10) {
      newWeight = Math.max(rule.weight - 5, 5);
    }

    if (newWeight !== rule.weight) {
      await this.prisma.fraudRule.update({
        where: { id: ruleId },
        data: { weight: newWeight, lastWeightAdjustment: new Date() },
      });
      this.logger.log(`Rule "${rule.name}" weight adjusted: ${rule.weight} → ${newWeight} (precision: ${(precision * 100).toFixed(0)}%)`);
    }
  }

  async computeUserBaseline(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const clicks = await this.prisma.click.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, ip: true },
    });

    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { amount: true },
    });

    const sessions = await this.prisma.session.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    });

    if (clicks.length === 0 && withdrawals.length === 0) return null;

    const totalHours = Math.max(1, Math.ceil((Date.now() - thirtyDaysAgo.getTime()) / 3600000));
    const avgClicksPerHour = clicks.length / totalHours;

    const hourlyCounts: number[] = new Array(24).fill(0);
    const ipPrefixes = new Set<string>();
    for (const c of clicks) {
      const hour = c.createdAt.getHours();
      hourlyCounts[hour]++;
      if (c.ip) ipPrefixes.add(c.ip.split('.').slice(0, 2).join('.'));
    }

    const mean = clicks.length / 24;
    const variance = hourlyCounts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / 24;
    const stdClicksPerHour = Math.sqrt(variance);

    const activeHours = hourlyCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count > 0)
      .sort((a, b) => b.count - a.count);
    const commonHours = activeHours.slice(0, 8).map(h => h.hour).sort((a, b) => a - b);

    const avgWithdrawal = withdrawals.length > 0
      ? withdrawals.reduce((sum, w) => sum + Number(w.amount), 0) / withdrawals.length
      : 0;
    const wVariance = withdrawals.length > 1
      ? withdrawals.reduce((sum, w) => sum + (Number(w.amount) - avgWithdrawal) ** 2, 0) / withdrawals.length
      : 0;
    const stdWithdrawal = Math.sqrt(wVariance);

    const sessionHours = sessions.map(s => s.createdAt.getHours());
    const peakStart = sessionHours.length > 0 ? Math.min(...sessionHours) : 8;
    const peakEnd = sessionHours.length > 0 ? Math.max(...sessionHours) : 23;

    await this.prisma.userBehaviorBaseline.upsert({
      where: { userId },
      create: {
        userId,
        avgClicksPerHour,
        stdClicksPerHour,
        commonHours,
        commonIpPrefixes: Array.from(ipPrefixes),
        avgWithdrawalAmount: avgWithdrawal,
        stdWithdrawalAmount: stdWithdrawal,
        peakActivityStart: peakStart,
        peakActivityEnd: peakEnd,
        totalSessions: sessions.length,
      },
      update: {
        avgClicksPerHour,
        stdClicksPerHour,
        commonHours,
        commonIpPrefixes: Array.from(ipPrefixes),
        avgWithdrawalAmount: avgWithdrawal,
        stdWithdrawalAmount: stdWithdrawal,
        peakActivityStart: peakStart,
        peakActivityEnd: peakEnd,
        totalSessions: sessions.length,
        lastUpdated: new Date(),
      },
    });

    return { avgClicksPerHour, stdClicksPerHour, commonHours, commonIpPrefixes: Array.from(ipPrefixes) };
  }

  async checkAnomalyScore(userId: string): Promise<number> {
    const baseline = await this.prisma.userBehaviorBaseline.findUnique({ where: { userId } });
    if (!baseline) return 0;

    let anomalyScore = 0;

    const recentClicks = await this.prisma.click.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } },
    });

    if (baseline.stdClicksPerHour > 0) {
      const zScore = (recentClicks - baseline.avgClicksPerHour) / baseline.stdClicksPerHour;
      if (zScore > 3) anomalyScore += Math.min(25, Math.round(zScore * 5));
    }

    const currentHour = new Date().getHours();
    if (baseline.commonHours.length > 0 && !baseline.commonHours.includes(currentHour)) {
      const recent24hClicks = await this.prisma.click.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 86400000) } },
      });
      if (recent24hClicks > 3) anomalyScore += 15;
    }

    return anomalyScore;
  }

  async getRuleRecommendations() {
    const rules = await this.prisma.fraudRule.findMany({ orderBy: { totalTriggers: 'desc' } });
    return rules.map(r => {
      const precision = r.totalTriggers > 0 ? r.sustainedCount / r.totalTriggers : 0;
      return {
        id: r.id,
        name: r.name,
        triggerType: r.triggerType,
        weight: r.weight,
        precision: Math.round(precision * 100),
        totalTriggers: r.totalTriggers,
        sustainedRate: r.totalTriggers > 0 ? Math.round((r.sustainedCount / r.totalTriggers) * 100) : 0,
        dismissedRate: r.totalTriggers > 0 ? Math.round((r.dismissedCount / r.totalTriggers) * 100) : 0,
        recommendation: precision >= 0.7 ? 'Increase weight' : precision <= 0.3 ? 'Reduce weight or disable' : 'Maintain',
      };
    });
  }

  async getDashboardStats() {
    const totalLogs = await this.prisma.fraudLog.count();
    const resolvedLogs = await this.prisma.fraudLog.count({ where: { resolved: true } });
    const sustainedLogs = await this.prisma.fraudLog.count({
      where: { resolved: true, resolvedNote: { contains: 'Sustained' } },
    });
    const activeSuspensions = await this.prisma.user.count({ where: { status: 'SUSPENDED' } });
    const activeFreezes = await this.prisma.user.count({ where: { status: 'FROZEN' } });

    return {
      totalFlags: totalLogs,
      resolvedRate: totalLogs > 0 ? Math.round((resolvedLogs / totalLogs) * 100) : 0,
      sustainRate: resolvedLogs > 0 ? Math.round((sustainedLogs / resolvedLogs) * 100) : 0,
      activeSuspensions,
      activeFreezes,
      avgResolutionTime: await this.averageResolutionTime(),
    };
  }

  private async averageResolutionTime(): Promise<number> {
    const resolved = await this.prisma.fraudLog.findMany({
      where: { resolved: true, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    });
    if (resolved.length === 0) return 0;
    const totalMinutes = resolved.reduce((sum, r) => {
      return sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 60000;
    }, 0);
    return Math.round(totalMinutes / resolved.length);
  }
}
