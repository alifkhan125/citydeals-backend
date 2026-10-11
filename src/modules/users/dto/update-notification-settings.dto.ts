import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  notificationsPaused!: boolean;

  @ApiProperty({ example: 2000, required: false, description: 'Nearby notification radius in meters.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50000)
  notificationRadiusMeters?: number;
}
