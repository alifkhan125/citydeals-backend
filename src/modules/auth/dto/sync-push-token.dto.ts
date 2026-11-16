import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SyncPushTokenDto {
  @ApiProperty({
    example: 'fcm-device-token',
    description: 'Native push token from the mobile device.',
  })
  @IsString()
  fcmToken!: string;

  @ApiPropertyOptional({
    description: 'Whether the iOS device is in development / sandbox mode',
  })
  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;
}
