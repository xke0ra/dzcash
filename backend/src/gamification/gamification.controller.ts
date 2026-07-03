import { Controller, Get, Post, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeaderboardPeriod } from '@prisma/client';

@Controller('gamification')
export class GamificationController {
  constructor(private gamificationService: GamificationService) {}

  @Get('xp')
  @UseGuards(JwtAuthGuard)
  async getXp(@Req() req: any) {
    return this.gamificationService.getUserXp(req.user.id);
  }

  @Get('levels')
  getLevels() {
    return this.gamificationService.getLevels();
  }

  @Get('badges')
  @UseGuards(JwtAuthGuard)
  async getBadges(@Req() req: any) {
    return this.gamificationService.getBadges(req.user.id);
  }

  @Get('leaderboard/:period')
  @UseGuards(JwtAuthGuard)
  async getLeaderboard(@Param('period') period: LeaderboardPeriod) {
    return this.gamificationService.getLeaderboard(period);
  }

  @Get('challenges')
  @UseGuards(JwtAuthGuard)
  async getChallenges(@Req() req: any) {
    return this.gamificationService.getActiveChallenges(req.user.id);
  }

  @Post('challenges/:id/claim')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async claimChallenge(@Req() req: any, @Param('id') challengeId: string) {
    return this.gamificationService.claimChallengeReward(req.user.id, challengeId);
  }

  @Post('login-streak')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async trackLogin(@Req() req: any) {
    return this.gamificationService.trackDailyLogin(req.user.id);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async seed() {
    await this.gamificationService.seedLevels();
    await this.gamificationService.seedBadges();
    return { message: 'Gamification data seeded' };
  }
}
