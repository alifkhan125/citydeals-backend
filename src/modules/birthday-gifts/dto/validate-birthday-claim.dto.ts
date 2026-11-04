import { IsString } from 'class-validator';

export class ValidateBirthdayClaimDto {
  @IsString() claimCode!: string;
  @IsString() merchantId!: string;
}
