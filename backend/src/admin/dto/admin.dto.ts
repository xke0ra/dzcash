import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, IsArray, IsNumber, Min } from 'class-validator';
import { UserStatus, UserRole, OfferProvider } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status!: UserStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  @IsNotEmpty()
  role!: UserRole;
}

export class OverrideRiskScoreDto {
  @IsNotEmpty()
  score!: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateOfferDto {
  @IsEnum(OfferProvider)
  @IsNotEmpty()
  provider!: OfferProvider;

  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  payoutAmount!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  rewardAmount!: number;

  @IsString()
  @IsNotEmpty()
  targetUrl!: string;

  @IsOptional()
  status?: boolean;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsOptional()
  countries?: string[];

  @IsArray()
  @IsOptional()
  devices?: string[];

  @IsString()
  @IsOptional()
  requirements?: string;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class UpdateOfferDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  payoutAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  rewardAmount?: number;

  @IsString()
  @IsOptional()
  targetUrl?: string;

  @IsOptional()
  status?: boolean;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsOptional()
  countries?: string[];

  @IsArray()
  @IsOptional()
  devices?: string[];

  @IsString()
  @IsOptional()
  requirements?: string;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class RejectWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ReviewFraudDto {
  @IsEnum(['dismiss', 'sustain'])
  @IsNotEmpty()
  action!: 'dismiss' | 'sustain';

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
