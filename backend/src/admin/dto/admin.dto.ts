import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserStatus, UserRole, OfferProvider, WithdrawalMethod } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status: UserStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}

export class OverrideRiskScoreDto {
  @IsNotEmpty()
  score: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateOfferDto {
  @IsEnum(OfferProvider)
  @IsNotEmpty()
  provider: OfferProvider;

  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNotEmpty()
  payoutAmount: number;

  @IsNotEmpty()
  rewardAmount: number;

  @IsString()
  @IsNotEmpty()
  targetUrl: string;

  @IsOptional()
  status?: boolean;
}

export class UpdateOfferDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  payoutAmount?: number;

  @IsOptional()
  rewardAmount?: number;

  @IsString()
  @IsOptional()
  targetUrl?: string;

  @IsOptional()
  status?: boolean;
}

export class RejectWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReviewFraudDto {
  @IsEnum(['dismiss', 'sustain'])
  @IsNotEmpty()
  action: 'dismiss' | 'sustain';

  @IsString()
  @IsOptional()
  notes?: string;
}

export class PaginationQueryDto {
  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 25;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsOptional()
  minRisk?: number;

  @IsOptional()
  maxRisk?: number;
}