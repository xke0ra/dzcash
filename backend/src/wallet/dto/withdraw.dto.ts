import { IsEnum, IsNotEmpty, IsNumber, IsObject, Min } from 'class-validator';
import { WithdrawalMethod } from '@prisma/client';

export class WithdrawDto {
  @IsEnum(WithdrawalMethod)
  @IsNotEmpty()
  method: WithdrawalMethod;

  @IsNumber()
  @Min(1.00)
  amount: number;

  @IsObject()
  @IsNotEmpty()
  details: Record<string, any>;
}
