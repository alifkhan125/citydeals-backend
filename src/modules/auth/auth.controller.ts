import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SyncLocationDto } from './dto/sync-location.dto.js';
import { SyncPushTokenDto } from './dto/sync-push-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { AppleLoginDto } from './dto/apple-login.dto.js';
import { RequestDeletionOtpDto, VerifyAndDeleteDto } from './dto/deletion.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('me')
  getMe(@GetUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-register-otp')
  @ApiOperation({ summary: 'Verify 6-digit OTP to complete registration' })
  verifyRegisterOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyRegisterOtp(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  googleLogin(@Body() dto: import('./dto/google-login.dto.js').GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('apple')
  appleLogin(@Body() dto: AppleLoginDto) {
    return this.authService.appleLogin(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('location/sync')
  syncLocation(@GetUser() user: { id: string }, @Body() dto: SyncLocationDto) {
    return this.authService.syncLocation(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('push-token/sync')
  syncPushToken(@GetUser() user: { id: string }, @Body() dto: SyncPushTokenDto) {
    return this.authService.syncPushToken(user.id, dto.fcmToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('change-password')
  changePassword(@GetUser() user: { id: string }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('refresh')
  refreshTokens(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('logout')
  logout(@GetUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }

  @Post('request-deletion-otp')
  @ApiOperation({ summary: 'Request OTP for web portal account deletion' })
  requestDeletionOtp(@Body() dto: RequestDeletionOtpDto) {
    return this.authService.requestDeletionOtp(dto);
  }

  @Post('verify-and-delete')
  @ApiOperation({ summary: 'Verify OTP and permanently delete account' })
  verifyAndDelete(@Body() dto: VerifyAndDeleteDto) {
    return this.authService.verifyAndDelete(dto);
  }
}

