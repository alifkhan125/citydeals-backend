import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'The Google ID Token received from the client', example: 'eyJhbGci...' })
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
