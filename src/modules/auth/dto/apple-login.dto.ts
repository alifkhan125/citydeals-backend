import { IsOptional, IsString } from 'class-validator';

export class AppleLoginDto {
  @IsString()
  identityToken!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  nonce?: string;
}
