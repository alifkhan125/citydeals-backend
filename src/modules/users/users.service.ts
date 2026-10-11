import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateLanguageDto } from './dto/update-language.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        dateOfBirth: true,
        role: true,
        preferredLanguage: true,
        notificationsPaused: true,
        notificationRadiusMeters: true,
        onboardingCompleted: true,
        latitude: true,
        longitude: true,
        createdAt: true,
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
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      stats: {
        savedCoupons: user._count.savedCoupons,
        couponRedeemed: user._count.couponRedemptions,
        unreadNotifications: user._count.notifications,
      },
      _count: undefined,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    await this.ensureUser(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        profilePictureUrl: dto.profilePictureUrl,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        dateOfBirth: true,
      },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.ensureUser(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl: avatarUrl },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        dateOfBirth: true,
      },
    });
  }

  async updateLanguage(userId: string, dto: UpdateLanguageDto) {
    await this.ensureUser(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: dto.preferredLanguage },
      select: { id: true, preferredLanguage: true },
    });
  }

  async updateNotificationSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    await this.ensureUser(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationsPaused: dto.notificationsPaused,
        notificationRadiusMeters: dto.notificationRadiusMeters,
      },
      select: { id: true, notificationsPaused: true, notificationRadiusMeters: true },
    });
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }
}
