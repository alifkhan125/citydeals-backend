import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBirthdaySettingsDto {
  @ApiProperty({ description: 'Whether automatic birthday perk notifications are enabled', example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ description: 'Perk category (e.g. Restaurant, Cafe, Retail)', example: 'Restaurant' })
  @IsString()
  category!: string;

  @ApiProperty({ description: 'Send time relative to birthday', example: 'On birthday' })
  @IsString()
  leadTime!: string; // 'On birthday' | '1 day before' | '7 days before'

  @ApiProperty({ description: 'Relative birthday notification schedule', example: ['7 days before', '1 day before', 'On birthday'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadTimes?: string[];
}
