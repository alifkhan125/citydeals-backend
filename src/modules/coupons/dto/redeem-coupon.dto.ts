import { IsString, MinLength } from 'class-validator';

export class RedeemCouponDto {
  @IsString()
  @MinLength(1)
  couponCode!: string;
}
