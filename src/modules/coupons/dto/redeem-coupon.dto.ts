import { IsOptional, IsString } from 'class-validator';

export class RedeemCouponDto {
  @IsOptional()
  @IsString()
  couponCode?: string;
}
