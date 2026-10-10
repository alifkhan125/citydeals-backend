import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SyncPushTokenDto {
  @ApiProperty({
    example: 'fcm-device-token',
    description: 'Native push token from the mobile device.',
  })
  @IsString()
  fcmToken!: string;
}
