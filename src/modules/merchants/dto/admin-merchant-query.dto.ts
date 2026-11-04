import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { MerchantStatus } from './create-merchant.dto.js';

export class AdminMerchantQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'coffee' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: MerchantStatus })
  @IsOptional()
  @IsEnum(MerchantStatus)
  status?: MerchantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  idsOnly?: string;
}
