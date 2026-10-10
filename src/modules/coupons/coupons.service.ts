import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { FilterCouponDto } from './dto/filter-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';
import { haversineDistanceMeters } from '../../common/utils/geo.util.js';

import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(user: { role: string; areaId?: string | null }, dto: CreateCouponDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: dto.merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (user.role !== 'ADMIN' && merchant.areaId !== user.areaId) {
      throw new ForbiddenException('Cannot create coupons outside your area');
    }
    return this.prisma.coupon.create({
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        couponCode: dto.couponCode,
        couponLink: dto.couponLink,
        redemptionLimit: dto.redemptionLimit,
        redemptionFrequency: dto.redemptionFrequency,
        discussion: dto.discussion,
        terms: dto.terms,
        merchantId: dto.merchantId,
        areaId: merchant.areaId,
        categoryId: dto.categoryId,
        isWhitelisted: dto.isWhitelisted ?? false,
        shareSlug: randomUUID(),
        status: dto.status ?? 'ACTIVE',
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async find(user: { id?: string; role?: string; areaId?: string | null } | null, filter: FilterCouponDto) {
    let areaId = filter.areaId;
    const isAllArea =
      filter.areaSlug?.toLowerCase() === 'all' ||
      filter.areaId?.toLowerCase() === 'all';

    if (!isAllArea) {
      if (!areaId && filter.areaSlug) {
        const area = await this.prisma.area.findUnique({ where: { slug: filter.areaSlug } });
        areaId = area?.id;
      }
    } else {
      areaId = undefined;
    }

    let categoryId = filter.categoryId;
    if (!categoryId && filter.categorySlug && filter.categorySlug.toLowerCase() !== 'all') {
      const category = await this.prisma.category.findUnique({
        where: { slug: filter.categorySlug.toLowerCase() },
      });
      categoryId = category?.id;
    }

    const whereClause: any = {};

    if (user?.role === 'ADMIN' || user?.role === 'STAFF') {
      if (filter.status) {
        whereClause.status = filter.status;
      }
    } else {
      whereClause.status = filter.status ?? 'ACTIVE';
    }

    if (areaId) {
      whereClause.areaId = areaId;
    }

    if (filter.merchantId) {
      whereClause.merchantId = filter.merchantId;
    }

    if (categoryId && categoryId.toLowerCase() !== 'all') {
      whereClause.categoryId = categoryId;
    }

    if (filter.search && filter.search.trim().length > 0) {
      const query = filter.search.trim();
      whereClause.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { couponCode: { contains: query, mode: 'insensitive' } },
        { merchant: { name: { contains: query, mode: 'insensitive' } } },
        { category: { name: { contains: query, mode: 'insensitive' } } },
      ];
    }

    let coupons = await this.prisma.coupon.findMany({
      where: whereClause,
      include: {
        merchant: {
          include: { category: true },
        },
        area: true,
        category: true,
        _count: {
          select: {
            savedBy: true,
            redemptions: true,
            viewEvents: true,
          },
        },
      },
      orderBy: [{ isWhitelisted: 'desc' }, { createdAt: 'desc' }],
    });

    if (areaId && coupons.length < 13) {
      const extraWhereClause = { ...whereClause, areaId: { not: areaId } };
      const extraCoupons = await this.prisma.coupon.findMany({
        where: extraWhereClause,
        include: {
          merchant: {
            include: { category: true },
          },
          area: true,
          category: true,
          _count: {
            select: {
              savedBy: true,
              redemptions: true,
              viewEvents: true,
            },
          },
        },
        take: 13 - coupons.length,
        orderBy: [{ isWhitelisted: 'desc' }, { createdAt: 'desc' }],
      });
      coupons = [...coupons, ...extraCoupons];
    }

    // Add distance and sort if user location is known
    let userRecord = null;
    if (user?.id) {
      userRecord = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { latitude: true, longitude: true },
      });
    }

    if (userRecord?.latitude && userRecord?.longitude) {
      const userLat = Number(userRecord.latitude);
      const userLon = Number(userRecord.longitude);
      
      coupons = coupons.map(c => {
        const mLat = Number(c.merchant.latitude);
        const mLon = Number(c.merchant.longitude);
        const distanceMeters = (mLat && mLon) 
          ? haversineDistanceMeters({ latitude: userLat, longitude: userLon }, { latitude: mLat, longitude: mLon })
          : Infinity;
        
        return { ...c, distanceMeters };
      });

      // Sort: Whitelisted first, then nearest first
      coupons.sort((a: any, b: any) => {
        if (a.isWhitelisted && !b.isWhitelisted) return -1;
        if (!a.isWhitelisted && b.isWhitelisted) return 1;
        return a.distanceMeters - b.distanceMeters;
      });
    }

    if (user?.id) {
      const savedCoupons = await this.prisma.savedCoupon.findMany({
        where: { userId: user.id },
        select: { couponId: true },
      });
      const savedIds = new Set(savedCoupons.map((s) => s.couponId));
      return coupons.map((c: any) => ({
        ...c,
        isSaved: savedIds.has(c.id),
        likes: c._count?.savedBy || 0,
        redemptions: c._count?.redemptions || 0,
        views: c._count?.viewEvents || 0,
        _count: undefined,
      }));
    }

    return coupons.map((c: any) => ({
      ...c,
      isSaved: false,
      likes: c._count?.savedBy || 0,
      redemptions: c._count?.redemptions || 0,
      views: c._count?.viewEvents || 0,
      _count: undefined,
    }));
  }

  async findPublicByShareSlug(shareSlug: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { shareSlug },
      include: { merchant: true, area: true, category: true },
    });
    if (!coupon || coupon.status !== 'ACTIVE') {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  async saveCoupon(userId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    const saved = await this.prisma.savedCoupon.upsert({
      where: { userId_couponId: { userId, couponId } },
      update: {},
      create: { userId, couponId },
    });
    return { ...saved, saved: true };
  }

  async unsaveCoupon(userId: string, couponId: string) {
    await this.prisma.savedCoupon.deleteMany({ where: { userId, couponId } });
    return { couponId, saved: false };
  }

  async findSavedCoupons(userId: string) {
    const saved = await this.prisma.savedCoupon.findMany({
      where: { userId },
      include: { coupon: { include: { merchant: true, area: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return saved.filter((s) => s.coupon).map((s) => ({ ...s.coupon, isSaved: true }));
  }

  async findRedeemedCoupons(userId: string) {
    const redemptions = await this.prisma.couponRedemption.findMany({
      where: { userId },
      include: {
        coupon: {
          include: {
            merchant: { include: { category: true } },
            area: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return redemptions
      .filter((r) => r.coupon)
      .map((r) => ({
        ...r.coupon,
        isRedeemed: true,
        redeemedAt: r.createdAt,
      }));
  }

  update(id: string, dto: UpdateCouponDto = {}) {
    const { startsAt, expiresAt, merchantId, categoryId, ...data } = dto;
    const updateData: any = {
      ...data,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };
    if (merchantId) updateData.merchantId = merchantId;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    return this.prisma.coupon.update({
      where: { id },
      data: updateData,
    });
  }

  async findById(id: string, userId?: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        merchant: {
          include: { category: true },
        },
        area: true,
        category: true,
        _count: {
          select: { redemptions: true, savedBy: true },
        },
      },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    let isSaved = false;
    let isRedeemed = false;
    if (userId) {
      const [saved, redeemed] = await Promise.all([
        this.prisma.savedCoupon.findFirst({ where: { userId, couponId: id } }),
        this.prisma.couponRedemption.findFirst({ where: { userId, couponId: id } }),
      ]);
      isSaved = !!saved;
      isRedeemed = !!redeemed;
    }

    return {
      ...coupon,
      isSaved,
      isRedeemed,
    };
  }

  async trackView(couponId: string, userId?: string, source = 'APP') {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    await this.prisma.couponViewEvent.create({
      data: {
        couponId,
        userId,
        source,
      },
    });

    const views = await this.prisma.couponViewEvent.count({ where: { couponId } });
    return { couponId, views };
  }

  async redeemCoupon(userId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { merchant: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.status !== 'ACTIVE') throw new BadRequestException('Coupon is not active');

    // Check expiration if any
    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      throw new BadRequestException('This coupon has expired');
    }

    // Check redemption frequency / limits
    if (coupon.redemptionFrequency === 'ONE_TIME') {
      const existing = await this.prisma.couponRedemption.findFirst({
        where: { userId, couponId },
      });
      if (existing) {
        throw new ConflictException('You have already redeemed this coupon');
      }
    } else if (coupon.redemptionFrequency === 'DAILY') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const existingToday = await this.prisma.couponRedemption.findFirst({
        where: {
          userId,
          couponId,
          createdAt: { gte: startOfDay },
        },
      });
      if (existingToday) {
        throw new ConflictException('You can only redeem this coupon once per day');
      }
    } else if (coupon.redemptionFrequency === 'WEEKLY') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const existingWeek = await this.prisma.couponRedemption.findFirst({
        where: {
          userId,
          couponId,
          createdAt: { gte: oneWeekAgo },
        },
      });
      if (existingWeek) {
        throw new ConflictException('You can only redeem this coupon once per week');
      }
    }

    // Check total redemption limit if set
    if (coupon.redemptionLimit) {
      const totalRedemptions = await this.prisma.couponRedemption.count({
        where: { couponId },
      });
      if (totalRedemptions >= coupon.redemptionLimit) {
        throw new BadRequestException('This coupon has reached its total redemption limit');
      }
    }

    const redemption = await this.prisma.couponRedemption.create({
      data: { userId, couponId },
      include: {
        coupon: {
          include: { merchant: true },
        },
      },
    });

    return {
      success: true,
      message: 'Coupon redeemed successfully',
      redemptionId: redemption.id,
      redeemedAt: redemption.createdAt,
      couponCode: coupon.couponCode,
      couponTitle: coupon.title,
      merchantName: coupon.merchant?.name,
    };
  }

  async remove(id: string) {
    await this.prisma.coupon.delete({ where: { id } });
    return { id, deleted: true };
  }

  async notifyNearbyUsers(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { merchant: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (!coupon.merchant.latitude || !coupon.merchant.longitude) {
      throw new BadRequestException('Merchant location is missing');
    }

    const allUsers = await this.prisma.user.findMany({
      where: { notificationsPaused: false, fcmToken: { not: null } },
      select: { id: true, fcmToken: true, latitude: true, longitude: true },
    });

    const mLat = Number(coupon.merchant.latitude);
    const mLon = Number(coupon.merchant.longitude);

    const nearbyUsers = allUsers.filter((user) => {
      if (!user.latitude || !user.longitude || !user.fcmToken) return false;
      const uLat = Number(user.latitude);
      const uLon = Number(user.longitude);
      const distance = haversineDistanceMeters(
        { latitude: uLat, longitude: uLon },
        { latitude: mLat, longitude: mLon },
      );
      return distance <= 3000;
    });

    if (nearbyUsers.length === 0) {
      return { sent: 0, message: 'No nearby users found' };
    }

    // We can use Expo/Firebase util directly, or `enqueueProximityNotification` which is private/public. 
    // `enqueueProximityNotification` takes { userId, merchantId }. We want one broadcast.
    
    // Using NotificationsService.send won't filter by distance easily unless we create a custom SendNotificationDto.
    // Instead we can send directly here using expo-push/firebase-push util if we want, or add a method to NotificationsService.
    
    // Actually, `enqueueProximityNotification` is public. But it's for 1 user.
    // Let's just use the utils.
    
    const { sendExpoPushMessages } = await import('../notifications/expo-push.util.js');
    const { sendFirebasePushMessages } = await import('../notifications/firebase-push.util.js');

    await this.prisma.notification.createMany({
      data: nearbyUsers.map((user) => ({
        userId: user.id,
        title: 'Hot Deal Nearby!',
        body: `${coupon.title} is just around the corner at ${coupon.merchant.name}. Tap to grab it now!`,
        data: { sourceType: 'COUPON', couponId: coupon.id },
      })),
    });

    const messages = nearbyUsers.map(u => ({
      to: u.fcmToken as string,
      token: u.fcmToken as string,
      title: 'Hot Deal Nearby!',
      body: `${coupon.title} is just around the corner at ${coupon.merchant.name}. Tap to grab it now!`,
      data: { sourceType: 'COUPON', couponId: coupon.id },
      channelId: 'deals',
    }));

    const fcmMessages = messages.filter((m) => !m.to.startsWith('ExpoPushToken[') && !m.to.startsWith('ExponentPushToken['));
    const expoMessages = messages.filter((m) => m.to.startsWith('ExpoPushToken[') || m.to.startsWith('ExponentPushToken['));

    if (fcmMessages.length > 0) await sendFirebasePushMessages(fcmMessages);
    if (expoMessages.length > 0) await sendExpoPushMessages(expoMessages);

    return { sent: nearbyUsers.length, message: `Notification sent to ${nearbyUsers.length} users within 3km` };
  }
}
