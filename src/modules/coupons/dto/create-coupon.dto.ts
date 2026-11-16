import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export { CouponStatus };

export enum CouponRedemptionFrequency {
  ONE_TIME = 'ONE_TIME',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  UNLIMITED = 'UNLIMITED',
}

export enum CouponAudience {
  ALL_USERS = 'ALL_USERS',
  BIRTHDAY_USERS_ONLY = 'BIRTHDAY_USERS_ONLY',
  ALL_USERS_AND_BIRTHDAY_GIFT = 'ALL_USERS_AND_BIRTHDAY_GIFT',
}

export class CreateCouponDto {
  @ApiPropertyOptional({ enum: CouponAudience, default: CouponAudience.ALL_USERS })
  @IsOptional()
  @IsEnum(CouponAudience)
  audience?: CouponAudience;
  @ApiPropertyOptional({ enum: CouponStatus, example: CouponStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;
  @ApiProperty({
    example: 'Buy 1 Coffee, Get 1 Free',
    description: 'Coupon title shown in app and share preview.',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    example: 'Show this coupon at checkout to get a free coffee with any coffee purchase.',
    description: 'Full coupon terms or marketing copy.',
  })
  @IsString()
  description!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.citydeals.test/coupons/kendall-coffee-bogo.jpg',
    description: 'Coupon image used in listings and OG share previews.',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'BOGO2026' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 'https://merchant.example.com/deal' })
  @IsOptional()
  @IsString()
  couponLink?: string;

  @ApiProperty({
    example: 'replace-with-created-merchant-id',
    description: 'Create a merchant first, then paste its id here.',
  })
  @IsString()
  merchantId!: string;

  @ApiPropertyOptional({
    example: 'replace-with-created-category-id',
    description: 'Optional category id used for category tab filtering.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Featured/whitelisted coupons appear first in listings.',
  })
  @IsOptional()
  @IsBoolean()
  isWhitelisted?: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  redemptionLimit?: number;

  @ApiPropertyOptional({ enum: CouponRedemptionFrequency, example: CouponRedemptionFrequency.ONE_TIME })
  @IsOptional()
  @IsEnum(CouponRedemptionFrequency)
  redemptionFrequency?: CouponRedemptionFrequency;

  @ApiPropertyOptional({ example: 'Available this weekend only.' })
  @IsOptional()
  @IsString()
  discussion?: string;

  @ApiPropertyOptional({ example: 'Cannot be combined with other offers.' })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({
    example: '2026-09-10T00:00:00.000Z',
    description: 'Optional coupon start date/time.',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Optional coupon expiry date/time.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
