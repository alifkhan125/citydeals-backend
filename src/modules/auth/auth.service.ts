import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service.js';
import { AreasService } from '../areas/areas.service.js';
import { MailService } from '../mail/mail.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SyncLocationDto } from './dto/sync-location.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { OAuth2Client } from 'google-auth-library';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { AppleLoginDto } from './dto/apple-login.dto.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { NotificationsService } from '../notifications/notifications.service.js';

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly areasService: AreasService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptedTerms) {
      throw new BadRequestException('Terms and conditions must be accepted');
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.status !== 'DELETED') {
      throw new ConflictException('Email is already registered');
    }

    // Generate 6-digit verification code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in RegistrationOtp table
    await this.prisma.registrationOtp.upsert({
      where: { email },
      update: {
        otp,
        payloadJson: JSON.stringify(dto),
        expiresAt,
      },
      create: {
        email,
        otp,
        payloadJson: JSON.stringify(dto),
        expiresAt,
      },
    });

    this.logger.log(`[AUTH] ✉️ Signup verification OTP for ${email}: ${otp}`);
    await this.mailService.sendRegistrationOtp(email, otp, dto.fullName);

    return {
      requireOtp: true,
      email,
      message: 'A 6-digit verification code has been sent to your email.',
      ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
    };
  }

  async verifyRegisterOtp(dto: { email: string; otp: string }) {
    const email = dto.email.trim().toLowerCase();
    const record = await this.prisma.registrationOtp.findUnique({
      where: { email },
    });

    if (!record) {
      throw new BadRequestException('No pending registration found for this email.');
    }

    if (record.otp !== dto.otp.trim()) {
      throw new BadRequestException('Invalid verification code.');
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestException('Verification code has expired. Please sign up again.');
    }

    const registerPayload: RegisterDto = JSON.parse(record.payloadJson);

    // Clean up OTP record
    await this.prisma.registrationOtp.delete({
      where: { email },
    });

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.status === 'DELETED') {
      const area = registerPayload.latitude && registerPayload.longitude
        ? await this.areasService.resolveArea(registerPayload.latitude, registerPayload.longitude)
        : null;
      const restoredUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: registerPayload.fullName,
          email,
          phoneNumber: registerPayload.phoneNumber,
          profilePictureUrl: registerPayload.profilePictureUrl,
          dateOfBirth: registerPayload.dateOfBirth ? new Date(registerPayload.dateOfBirth) : null,
          passwordHash: await bcrypt.hash(registerPayload.password, 12),
          role: registerPayload.role ?? existingUser.role,
          preferredLanguage: registerPayload.preferredLanguage ?? existingUser.preferredLanguage,
          acceptedTerms: registerPayload.acceptedTerms,
          onboardingCompleted: registerPayload.onboardingCompleted ?? true,
          notificationsPaused: registerPayload.notificationsPaused ?? false,
          areaId: area?.id ?? null,
          latitude: registerPayload.latitude ?? null,
          longitude: registerPayload.longitude ?? null,
          status: 'ACTIVE',
          deletedAt: null,
          fcmToken: null,
          refreshTokenHash: null,
          resetPasswordOtp: null,
          resetPasswordExpiresAt: null,
        },
        include: {
          area: {
            select: {
              id: true, name: true, slug: true, city: true, state: true,
              latitude: true, longitude: true,
            },
          },
        },
      });
      return this.issueTokens(restoredUser);
    }

    const area = registerPayload.latitude && registerPayload.longitude
      ? await this.areasService.resolveArea(registerPayload.latitude, registerPayload.longitude)
      : null;

    const user = await this.prisma.user.create({
      data: {
        fullName: registerPayload.fullName,
        email,
        phoneNumber: registerPayload.phoneNumber,
        profilePictureUrl: registerPayload.profilePictureUrl,
        dateOfBirth: registerPayload.dateOfBirth ? new Date(registerPayload.dateOfBirth) : undefined,
        passwordHash: await bcrypt.hash(registerPayload.password, 12),
        role: registerPayload.role ?? 'USER',
        preferredLanguage: registerPayload.preferredLanguage ?? 'en',
        acceptedTerms: registerPayload.acceptedTerms,
        onboardingCompleted: registerPayload.onboardingCompleted ?? true,
        notificationsPaused: registerPayload.notificationsPaused ?? false,
        areaId: area?.id,
        latitude: registerPayload.latitude,
        longitude: registerPayload.longitude,
      },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    return this.issueTokens(user);
  }

  async googleLogin(dto: GoogleLoginDto) {
    const client = new OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));
    try {
      const ticket = await client.verifyIdToken({
        idToken: dto.idToken,
        audience: [
          this.configService.get('GOOGLE_WEB_CLIENT_ID') || '',
          this.configService.get('GOOGLE_ANDROID_CLIENT_ID') || '',
          this.configService.get('GOOGLE_IOS_CLIENT_ID') || '',
        ].filter(Boolean),
      });
      const payload = ticket.getPayload();
      
      if (!payload || !payload.email) {
        throw new BadRequestException('Invalid Google token');
      }

      let user = await this.prisma.user.findUnique({
        where: { email: payload.email },
        include: {
          area: {
            select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true },
          },
        },
      });

      if (!user) {
        // Register new user via Google
        user = await this.prisma.user.create({
          data: {
            fullName: payload.name || 'Google User',
            email: payload.email,
            profilePictureUrl: payload.picture,
            passwordHash: await bcrypt.hash(Math.random().toString(36).slice(-10), 12),
            role: 'USER',
            preferredLanguage: 'en',
            acceptedTerms: true,
            onboardingCompleted: true,
          },
          include: {
            area: {
              select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true },
            },
          },
        });
      } else if (user.status === 'DELETED') {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            fullName: payload.name || user.fullName,
            profilePictureUrl: payload.picture || user.profilePictureUrl,
            status: 'ACTIVE',
            deletedAt: null,
            fcmToken: null,
            refreshTokenHash: null,
          },
          include: {
            area: {
              select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true },
            },
          },
        });
      }

      return this.issueTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  async appleLogin(dto: AppleLoginDto) {
    try {
      const audience = this.configService.get<string>('APPLE_CLIENT_ID') || 'com.citydeals.app';
      const { payload } = await jwtVerify(dto.identityToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience,
      });

      const appleSubject = typeof payload.sub === 'string' ? payload.sub : null;
      const tokenEmail = typeof payload.email === 'string' ? payload.email : undefined;
      const email = tokenEmail || dto.email;
      if (!appleSubject) throw new UnauthorizedException('Invalid Apple token');

      let user = await this.prisma.user.findUnique({
        where: { appleSubject },
        include: { area: { select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true } } },
      });

      if (!user && email) {
        user = await this.prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { area: { select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true } } },
        });
      }

      if (!user && !email) {
        throw new BadRequestException('Apple did not provide an email. Please sign in again.');
      }

      const displayName = dto.fullName || 'Apple User';
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            fullName: displayName,
            email: email!,
            appleSubject,
            passwordHash: await bcrypt.hash(Math.random().toString(36).slice(-10), 12),
            role: 'USER',
            preferredLanguage: 'en',
            acceptedTerms: true,
            onboardingCompleted: true,
          },
          include: { area: { select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true } } },
        });
      } else {
        if (user.status === 'BANNED') throw new ForbiddenException('This user is banned');
        if (user.status === 'SUSPENDED') throw new ForbiddenException('This user is suspended');

        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            appleSubject: user.appleSubject || appleSubject,
            ...(user.status === 'DELETED'
              ? { status: 'ACTIVE', deletedAt: null, fcmToken: null, refreshTokenHash: null }
              : {}),
            ...(user.fullName ? {} : { fullName: displayName }),
          },
          include: { area: { select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true } } },
        });
      }

      return this.issueTokens(user);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Invalid Apple token');
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === 'BANNED') throw new ForbiddenException('This user is banned');
    if (user.status === 'SUSPENDED') throw new ForbiddenException('This user is suspended');
    if (user.status === 'DELETED') throw new ForbiddenException('This account has been deleted');

    // If ADMIN role, look up their StaffAccount to get the roleKey for permission checks
    let staffRoleKey: string | undefined;
    if (user.role === 'ADMIN') {
      const staffAccount = await this.prisma.staffAccount.findUnique({
        where: { email: user.email },
        select: { roleKey: true },
      });
      staffRoleKey = staffAccount?.roleKey ?? undefined;
    }

    return this.issueTokens(user, staffRoleKey);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        role: true,
        status: true,
        notificationsPaused: true,
        notificationRadiusMeters: true,
        areaId: true,
        latitude: true,
        longitude: true,
        _count: {
          select: {
            savedCoupons: true,
            couponRedemptions: true,
            notifications: { where: { readAt: null } },
          },
        },
        area: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Include staffRoleKey for ADMIN users so the dashboard can check permissions
    let staffRoleKey: string | undefined;
    if (user.role === 'ADMIN') {
      const staffAccount = await this.prisma.staffAccount.findUnique({
        where: { email: user.email },
        select: { roleKey: true },
      });
      staffRoleKey = staffAccount?.roleKey ?? undefined;
    }

    return {
      ...user,
      staffRoleKey,
      stats: {
        savedCoupons: user._count.savedCoupons,
        couponRedeemed: user._count.couponRedemptions,
        unreadNotifications: user._count.notifications,
      },
      _count: undefined,
    };
  }

  async syncLocation(userId: string, dto: SyncLocationDto) {
    const area = await this.areasService.resolveArea(dto.latitude, dto.longitude);
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        fcmToken: dto.fcmToken,
        areaId: area?.id,
      },
      select: {
        id: true,
        areaId: true,
        latitude: true,
        longitude: true,
        notificationRadiusMeters: true,
        area: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    // Proximity logic
    const merchants = area
      ? await this.prisma.merchant.findMany({
          where: { areaId: area.id, status: 'ACTIVE', isDeleted: false },
          include: { area: true, coupons: { where: { status: 'ACTIVE', isDeleted: false } } },
        })
      : [];

    const { haversineDistanceMeters } = await import('../../common/utils/geo.util.js');
    const nearbyMerchants = merchants
      .map((merchant) => ({
        ...merchant,
        distanceMeters: haversineDistanceMeters(
          { latitude: dto.latitude, longitude: dto.longitude },
            {
              latitude: Number(merchant.latitude),
              longitude: Number(merchant.longitude),
            },
        ),
      }))
      .filter(
        (merchant) =>
          merchant.distanceMeters <= merchant.radiusMeters &&
          merchant.distanceMeters <= updatedUser.notificationRadiusMeters &&
          merchant.coupons.length > 0,
      );

    if (nearbyMerchants.length > 0) {
      const merchantIds = nearbyMerchants.map((m) => m.id);
      const totalCoupons = nearbyMerchants.reduce((sum, m) => sum + m.coupons.length, 0);
      
      console.log(`[Location Sync] Sending proximity notification synchronously for user ${userId} with ${merchantIds.length} merchants and ${totalCoupons} coupons`);
      await this.notificationsService.sendGroupedProximityNotificationSync(
        userId,
        merchantIds,
        totalCoupons,
      );
    } else {
      console.log(`[Location Sync] No nearby active merchants found for user ${userId}`);
    }
    
    return updatedUser;
  }

  async syncPushToken(userId: string, fcmToken: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
      select: {
        id: true,
        fcmToken: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 12),
        refreshTokenHash: null,
      },
    });
    return { passwordChanged: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp: otp,
        resetPasswordExpiresAt: expiresAt,
      },
    });

    console.log(`[AUTH] 🔑 Password reset OTP for ${user.email}: ${otp}`);

    await this.mailService.sendPasswordResetOtp(user.email, otp, user.fullName ?? undefined);

    return {
      success: true,
      message: 'Verification code sent to your email address.',
      ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.resetPasswordOtp || !user.resetPasswordExpiresAt) {
      throw new BadRequestException('No pending password reset request found for this email.');
    }

    if (user.resetPasswordOtp !== dto.otp) {
      throw new BadRequestException('Invalid verification code. Please check and try again.');
    }

    if (new Date() > user.resetPasswordExpiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    return {
      success: true,
      message: 'Verification code is valid.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.resetPasswordOtp || !user.resetPasswordExpiresAt) {
      throw new BadRequestException('No pending password reset request found for this email.');
    }

    if (user.resetPasswordOtp !== dto.otp) {
      throw new BadRequestException('Invalid verification code. Please check and try again.');
    }

    if (new Date() > user.resetPasswordExpiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordOtp: null,
        resetPasswordExpiresAt: null,
        refreshTokenHash: null,
      },
    });

    return {
      success: true,
      message: 'Your password has been reset successfully. Please sign in with your new password.',
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    return { loggedOut: true };
  }


  async refreshTokens(refreshToken: string) {
    if (!refreshToken) throw new ForbiddenException('No refresh token provided');
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('auth.refreshSecret') ?? 'dev-only-refresh-change-me'
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              state: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });
      if (!user || !user.refreshTokenHash) {
        throw new ForbiddenException('Access Denied');
      }
      const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!refreshTokenMatches) {
        throw new ForbiddenException('Access Denied');
      }
      return this.issueTokens(user);
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
  }

  private async issueTokens(user: any, staffRoleKey?: string) {
    const payload = { sub: user.id, email: user.email, role: user.role, areaId: user.areaId };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshOptions: JwtSignOptions = {
      secret: this.configService.get<string>('auth.refreshSecret') ?? 'dev-only-refresh-change-me',
      expiresIn: this.configService.get<string>('auth.refreshExpiresIn') ?? '30d',
    } as JwtSignOptions;
    const refreshToken = await this.jwtService.signAsync(payload, refreshOptions);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(refreshToken, 12) },
    });
    
    // Don't leak password hash
    const { passwordHash: _passwordHash, refreshTokenHash: _refreshTokenHash, ...userWithoutSecrets } = user;
    
    return { 
      user: { ...userWithoutSecrets, staffRoleKey },
      tokens: { accessToken, refreshToken } 
    };
  }

  async requestDeletionOtp(dto: { email: string; password: string }) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.status === 'DELETED') {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Admin accounts cannot be deleted through self-service portal.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp: otp,
        resetPasswordExpiresAt: expiresAt,
      },
    });

    this.logger.log(`[AUTH] 🗑️ Account deletion OTP for ${user.email}: ${otp}`);
    await this.mailService.sendAccountDeletionOtp(user.email, otp, user.fullName ?? undefined);

    return {
      success: true,
      message: 'A 6-digit confirmation code has been sent to your email address.',
      ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
    };
  }

  async verifyAndDelete(dto: { email: string; otp: string }) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        savedCoupons: true,
        couponRedemptions: true,
        notificationEvents: true,
        notifications: true,
        supportTickets: true,
        birthdayClaims: true,
      },
    });

    if (!user || !user.resetPasswordOtp || !user.resetPasswordExpiresAt) {
      throw new BadRequestException('No pending deletion request found for this email.');
    }

    if (user.resetPasswordOtp !== dto.otp) {
      throw new BadRequestException('Invalid verification code. Please check and try again.');
    }

    if (new Date() > user.resetPasswordExpiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    // Permanently remove all user-associated records and the user entity
    await this.prisma.$transaction(async (tx) => {
      await tx.savedCoupon.deleteMany({ where: { userId: user.id } });
      await tx.couponRedemption.deleteMany({ where: { userId: user.id } });
      await tx.notificationCooldown.deleteMany({ where: { userId: user.id } });
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.supportTicket.deleteMany({ where: { userId: user.id } });
      await tx.birthdayClaim.deleteMany({ where: { userId: user.id } });

      await tx.user.delete({ where: { id: user.id } });
    });

    return {
      success: true,
      deleted: true,
      message: 'Your account and all associated data have been permanently deleted.',
    };
  }
}
