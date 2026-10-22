import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CouponStatus } from './create-coupon.dto.js';

export class FilterCouponDto {
  @ApiPropertyOptional({
    enum: CouponStatus,
    description: 'Filter coupons by status (e.g. ACTIVE, ARCHIVED, EXPIRED).',
  })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;
  @ApiPropertyOptional({
    example: 'madrid-centro',
    description: 'Area slug for scoped coupon listing, e.g. /coupons?areaSlug=madrid-centro.',
  })
  @IsOptional()
  @IsString()
  areaSlug?: string;

  @ApiPropertyOptional({
    example: 'area-uuid',
    description: 'Direct area ID filter.',
  })
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional({
    example: 'merchant-uuid',
    description: 'Optional merchant id filter within the selected area.',
  })
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiPropertyOptional({
    example: 'category-uuid',
    description: 'Filter coupons by category ID.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'restaurants',
    description: 'Filter coupons by category slug (e.g. restaurants, shopping, groceries).',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({
    example: 'croquettes',
    description: 'Text search query for coupon title, description, merchant name or code.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
