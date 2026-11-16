import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { CouponAudience, CouponStatus } from './create-coupon.dto.js';

export class AdminCouponQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'coffee' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CouponStatus })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiPropertyOptional({ enum: CouponAudience })
  @IsOptional()
  @IsEnum(CouponAudience)
  audience?: CouponAudience;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  idsOnly?: string;
}
