import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../email/email.module';
import { TwofaModule } from '../twofa/twofa.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    EmailModule,
    TwofaModule,
    GamificationModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
