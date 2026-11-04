import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBirthdayGiftDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() terms?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() category?: string;
  @IsString() merchantId!: string;
  @IsOptional() @IsString() couponId?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsInt() @Min(1) claimLimit?: number;
}
