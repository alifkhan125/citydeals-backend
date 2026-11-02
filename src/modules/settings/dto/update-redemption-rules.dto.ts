import { IsInt, IsIn, Min } from 'class-validator';

export class UpdateRedemptionRulesDto {
  @IsInt()
  @Min(0)
  cooldownValue!: number;

  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  cooldownUnit!: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}
