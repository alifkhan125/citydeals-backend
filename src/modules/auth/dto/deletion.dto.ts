import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class RequestDeletionOtpDto {
  @ApiProperty({
    example: 'user@citydeals.test',
    description: 'Email registered with the account.',
  })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Current password of the account.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required to request account deletion.' })
  password!: string;
}

export class VerifyAndDeleteDto {
  @ApiProperty({
    example: 'user@citydeals.test',
    description: 'Email registered with the account.',
  })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code received by the user.',
  })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits.' })
  otp!: string;
}
