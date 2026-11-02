import { IsInt, IsIn, IsOptional, Min } from 'class-validator';

export class UpdateRedemptionRulesDto {
  @IsInt()
  @Min(0)
  cooldownValue!: number;

  @IsIn(['HOURS', 'DAYS'])
  cooldownUnit!: 'HOURS' | 'DAYS';

  @IsInt()
  @Min(0)
  dailyLimit!: number;
}
