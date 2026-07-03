import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, Min } from 'class-validator';
import { WithdrawalMethod } from '@prisma/client';

export class WithdrawDto {
  @IsEnum(WithdrawalMethod)
  @IsNotEmpty()
  method!: WithdrawalMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsObject()
  @IsNotEmpty()
  details!: Record<string, any>;
}

export class BulkPayoutDto {
  @IsNotEmpty({ each: true })
  withdrawalIds!: string[];
}

export class ScheduleDto {
  @IsEnum(WithdrawalMethod)
  @IsNotEmpty()
  method!: WithdrawalMethod;

  @IsObject()
  @IsNotEmpty()
  details!: Record<string, any>;

  @IsNumber()
  @Min(1.00)
  threshold!: number;

  @IsOptional()
  enabled?: boolean;
}
