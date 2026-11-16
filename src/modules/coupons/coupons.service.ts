import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { FilterCouponDto } from './dto/filter-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';
import { AdminCouponQueryDto } from './dto/admin-coupon-query.dto.js';
import { haversineDistanceMeters } from '../../common/utils/geo.util.js';

import { NotificationsService } from '../notifications/notifications.service.js';
import { nextRedemptionAt } from './redemption-policy.js';
import { csvRecords } from '../../common/utils/csv.util.js';

@Injectable()
export class CouponsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    // Keep expired coupons out of the published catalog even when no admin opens the dashboard.
    void this.archiveExpiredCoupons();
    setInterval(() => {
      void this.archiveExpiredCoupons();
    }, 5 * 60 * 1000);
  }

  private async archiveExpiredCoupons() {
    const expired = await this.prisma.coupon.findMany({
      where: { status: 'ACTIVE', isDeleted: false, expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    if (!expired.length) return { archived: 0 };

    await this.prisma.coupon.updateMany({
      where: { id: { in: expired.map((coupon) => coupon.id) } },
      data: { status: 'ARCHIVED' },
    });
    await Promise.all(expired.map((coupon) => this.syncBirthdayGift(coupon.id)));
    return { archived: expired.length };
  }

  async create(user: { role: string; areaId?: string | null }, dto: CreateCouponDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: dto.merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (user.role !== 'ADMIN' && merchant.areaId !== user.areaId) {
      throw new ForbiddenException('Cannot create coupons outside your area');
    }
    const coupon = await this.prisma.coupon.create({
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        couponCode: dto.couponCode ? dto.couponCode.trim().toUpperCase() : undefined,
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
        audience: dto.audience ?? 'ALL_USERS',
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
    await this.syncBirthdayGift(coupon.id);
    return coupon;
  }

  private async syncBirthdayGift(couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { merchant: { include: { category: true } }, category: true },
    });
    if (!coupon) return;
    const existing = await this.prisma.birthdayGift.findFirst({ where: { couponId } });
    if (coupon.audience === 'ALL_USERS') {
      if (existing) await this.prisma.birthdayGift.update({ where: { id: existing.id }, data: { status: 'INACTIVE' } });
      return;
    }
    const data = {
      title: coupon.title,
      description: coupon.description,
      terms: coupon.terms,
      imageUrl: coupon.imageUrl,
      category: coupon.category?.name ?? coupon.merchant.category?.name ?? null,
      merchantId: coupon.merchantId,
      couponId: coupon.id,
      status: coupon.status === 'ACTIVE' && !coupon.isDeleted ? 'ACTIVE' as const : 'INACTIVE' as const,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
    };
    if (existing) await this.prisma.birthdayGift.update({ where: { id: existing.id }, data });
    else await this.prisma.birthdayGift.create({ data });
  }

  async findAdmin(query: AdminCouponQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.search?.trim();
    const where: any = {
      isDeleted: false,
      ...(query.status ? { status: query.status } : {}),
      ...(query.audience ? { audience: query.audience } : {}),
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.merchantId ? { merchantId: query.merchantId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { couponCode: { contains: search, mode: 'insensitive' } },
              { merchant: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    if (query.idsOnly === 'true') {
      const ids = await this.prisma.coupon.findMany({ where, select: { id: true } });
      return { ids: ids.map((item) => item.id) };
    }

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        include: {
          merchant: true,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      items: items.map((coupon: any) => ({
        ...coupon,
        likes: coupon._count?.savedBy ?? 0,
        redemptions: coupon._count?.redemptions ?? 0,
        views: coupon._count?.viewEvents ?? 0,
        _count: undefined,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async bulkStatus(dto: { ids: string[]; status: any }) {
    const result = await this.prisma.coupon.updateMany({
      where: { id: { in: dto.ids }, isDeleted: false },
      data: { status: dto.status },
    });
    await Promise.all(dto.ids.map((id) => this.syncBirthdayGift(id)));
    return { updated: result.count };
  }

  async bulkDelete(ids: string[]) {
    const result = await this.prisma.coupon.updateMany({
      where: { id: { in: ids }, isDeleted: false },
      data: { isDeleted: true, status: 'ARCHIVED' },
    });
    await Promise.all(ids.map((id) => this.syncBirthdayGift(id)));
    return { deleted: result.count, softDeleted: true };
  }

  async duplicate(id: string) {
    const source = await this.prisma.coupon.findFirst({ where: { id, isDeleted: false } });
    if (!source) throw new NotFoundException('Coupon not found');

    const duplicate = await this.prisma.coupon.create({
      data: {
        title: `${source.title} (Copy)`,
        description: source.description,
        imageUrl: source.imageUrl,
        couponCode: source.couponCode,
        couponLink: source.couponLink,
        redemptionLimit: source.redemptionLimit,
        redemptionFrequency: source.redemptionFrequency,
        discussion: source.discussion,
        terms: source.terms,
        merchantId: source.merchantId,
        areaId: source.areaId,
        categoryId: source.categoryId,
        isWhitelisted: source.isWhitelisted,
        shareSlug: randomUUID(),
        status: 'ARCHIVED',
        audience: source.audience,
        startsAt: source.startsAt,
        expiresAt: source.expiresAt,
      },
      include: { merchant: true, area: true, category: true },
    });
    await this.syncBirthdayGift(duplicate.id);
    return duplicate;
  }

  async importCsv(csv: string) {
    if (!csv?.trim()) throw new BadRequestException('CSV content is required');
    const records = csvRecords(csv);
    const imported: string[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, record] of records.entries()) {
      const row = index + 2;
      try {
        if (!record.title || !record.description || !record.business || !record.area) {
          throw new Error('title, description, business and area are required');
        }
        const merchant = await this.prisma.merchant.findFirst({ where: { name: record.business, isDeleted: false } });
        if (!merchant) throw new Error(`Business not found: ${record.business}`);
        const area = await this.prisma.area.findFirst({ where: { slug: record.area, isDeleted: false } });
        if (!area) throw new Error(`Area not found: ${record.area}`);
        const category = record.category ? await this.prisma.category.findFirst({ where: { slug: record.category, isDeleted: false } }) : null;
        if (record.category && !category) throw new Error(`Category not found: ${record.category}`);
        const status = record.status || 'ACTIVE';
        if (!['ACTIVE', 'ARCHIVED', 'EXPIRED', 'SUSPENDED'].includes(status)) throw new Error(`Invalid status: ${status}`);
        const existing = await this.prisma.coupon.findFirst({ where: { title: record.title, merchantId: merchant.id, isDeleted: false } });
        if (existing) throw new Error('Duplicate coupon title for this business');

        const coupon = await this.prisma.coupon.create({
          data: {
            title: record.title,
            description: record.description,
            merchantId: merchant.id,
            areaId: area.id,
            categoryId: category?.id,
            couponCode: record.couponCode || undefined,
            couponLink: record.couponLink || undefined,
            imageUrl: record.imageUrl || undefined,
            terms: record.terms || undefined,
            discussion: record.discussion || undefined,
            redemptionLimit: record.redemptionLimit ? Number(record.redemptionLimit) : undefined,
            startsAt: record.startsAt ? new Date(record.startsAt) : undefined,
            expiresAt: record.expiresAt ? new Date(record.expiresAt) : undefined,
            status: status as any,
            audience: (record.audience || 'ALL_USERS') as any,
            shareSlug: randomUUID(),
          },
        });
        await this.syncBirthdayGift(coupon.id);
        imported.push(coupon.id);
      } catch (error) {
        errors.push({ row, message: error instanceof Error ? error.message : 'Invalid row' });
      }
    }

    return { imported: imported.length, failed: errors.length, ids: imported, errors };
  }

  async find(user: { id?: string; role?: string; areaId?: string | null } | null, filter: FilterCouponDto) {
    let areaId = filter.areaId;
    const isAllArea =
      filter.areaSlug?.toLowerCase() === 'all' ||
      filter.areaId?.toLowerCase() === 'all';

    if (!isAllArea) {
      if (!areaId && filter.areaSlug) {
        const area = await this.prisma.area.findFirst({ where: { slug: filter.areaSlug, isDeleted: false } });
        areaId = area?.id;
      }
    } else {
      areaId = undefined;
    }

    let categoryId = filter.categoryId;
    if (!categoryId && filter.categorySlug && filter.categorySlug.toLowerCase() !== 'all') {
      const category = await this.prisma.category.findFirst({
        where: { slug: filter.categorySlug.toLowerCase(), isDeleted: false },
      });
      categoryId = category?.id;
    }

    const whereClause: any = {
      isDeleted: false,
      area: { isDeleted: false },
      merchant: { isDeleted: false },
      OR: [{ categoryId: null }, { category: { isDeleted: false } }],
    };

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

    let userRecord: { latitude: any; longitude: any; dateOfBirth: Date | null; status: string } | null = null;
    if (user?.id) {
      userRecord = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { latitude: true, longitude: true, dateOfBirth: true, status: true },
      });
    }
    if (user?.role !== 'ADMIN' && user?.role !== 'STAFF') {
      const dob = userRecord?.dateOfBirth ? new Date(userRecord.dateOfBirth) : null;
      const now = new Date();
      const isBirthday = !!dob && dob.getUTCMonth() === now.getUTCMonth() && dob.getUTCDate() === now.getUTCDate();
      whereClause.audience = isBirthday
        ? { in: ['ALL_USERS', 'BIRTHDAY_USERS_ONLY', 'ALL_USERS_AND_BIRTHDAY_GIFT'] }
        : { in: ['ALL_USERS', 'ALL_USERS_AND_BIRTHDAY_GIFT'] };
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
    if (userRecord?.latitude && userRecord?.longitude) {
      const userLat = Number(userRecord.latitude);
      const userLon = Number(userRecord.longitude);
      
      coupons = coupons.map(c => {
        const mLat = Number(c.merchant?.latitude ?? c.area?.latitude);
        const mLon = Number(c.merchant?.longitude ?? c.area?.longitude);
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
    if (!coupon || coupon.isDeleted || coupon.status !== 'ACTIVE') {
      throw new NotFoundException('Coupon not found');
    }
    if (coupon.audience === 'BIRTHDAY_USERS_ONLY') {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  async saveCoupon(userId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || coupon.isDeleted) throw new NotFoundException('Coupon not found');
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
      where: { userId, coupon: { status: 'ACTIVE', isDeleted: false } },
      select: {
        coupon: {
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            couponCode: true,
            couponLink: true,
            shareSlug: true,
            status: true,
            startsAt: true,
            expiresAt: true,
            areaId: true,
            merchantId: true,
            categoryId: true,
            isWhitelisted: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                iconUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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

  async update(id: string, dto: UpdateCouponDto = {}) {
    const { startsAt, expiresAt, merchantId, categoryId, ...data } = dto;
    const updateData: any = {
      ...data,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };
    if (data.couponCode !== undefined) {
      updateData.couponCode = data.couponCode ? data.couponCode.trim().toUpperCase() : null;
    }
    if (merchantId) {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant) throw new NotFoundException('Merchant not found');
      updateData.merchantId = merchantId;
      updateData.areaId = merchant.areaId;
    }
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: updateData,
    });
    await this.syncBirthdayGift(coupon.id);
    return coupon;
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
    if (coupon.isDeleted || coupon.status !== 'ACTIVE') {
      throw new NotFoundException('Coupon not found');
    }

    if (coupon.audience === 'BIRTHDAY_USERS_ONLY') {
      if (!userId) throw new NotFoundException('Coupon not found');
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true, status: true } });
      const dob = user?.dateOfBirth ? new Date(user.dateOfBirth) : null;
      const now = new Date();
      if (!user || user.status !== 'ACTIVE' || !dob || dob.getUTCMonth() !== now.getUTCMonth() || dob.getUTCDate() !== now.getUTCDate()) {
        throw new NotFoundException('Coupon not found');
      }
    }

    let isSaved = false;
    let isRedeemed = false;
    let redeemedAt: Date | null = null;
    let redemptionAvailableAt: Date | null = null;
    if (userId) {
      const [saved, redeemed] = await Promise.all([
        this.prisma.savedCoupon.findFirst({ where: { userId, couponId: id } }),
        this.prisma.couponRedemption.findFirst({ where: { userId, couponId: id }, orderBy: { createdAt: 'desc' } }),
      ]);
      isSaved = !!saved;
      redeemedAt = redeemed?.createdAt ?? null;

      if (redeemed) {
        if (coupon.redemptionFrequency === 'ONE_TIME') {
          isRedeemed = true;
          redemptionAvailableAt = null;
        } else if (coupon.redemptionFrequency === 'UNLIMITED') {
          isRedeemed = false;
          redemptionAvailableAt = null;
        } else {
          const nextAt = nextRedemptionAt(coupon.redemptionFrequency, redeemed.createdAt);
          if (nextAt && new Date() < nextAt) {
            // Still in cooldown period
            isRedeemed = true;
            redemptionAvailableAt = nextAt;
          } else {
            // Cooldown has expired! User can redeem again
            isRedeemed = false;
            redemptionAvailableAt = null;
          }
        }
      }
    }

    return {
      ...coupon,
      isSaved,
      isRedeemed,
      redeemedAt,
      redemptionAvailableAt,
    };
  }

  async trackView(couponId: string, userId?: string, source = 'APP') {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, isDeleted: true },
    });
    if (!coupon || coupon.isDeleted) throw new NotFoundException('Coupon not found');

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

  async redeemCoupon(userId: string, couponId: string, enteredCouponCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'BANNED') throw new ForbiddenException('This user is banned');
    if (user.status === 'SUSPENDED') throw new ForbiddenException('This user is suspended');

    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { merchant: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.status !== 'ACTIVE') throw new BadRequestException('Coupon is not active');

    const expectedCode = coupon.couponCode?.trim().toUpperCase();
    const receivedCode = enteredCouponCode?.trim().toUpperCase();
    if (!expectedCode || !receivedCode || expectedCode !== receivedCode) {
      throw new ForbiddenException('Invalid coupon code. Please check the coupon code and try again.');
    }

    if (coupon.audience === 'BIRTHDAY_USERS_ONLY') {
      const birthdayUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } });
      const dob = birthdayUser?.dateOfBirth ? new Date(birthdayUser.dateOfBirth) : null;
      const today = new Date();
      if (!dob || dob.getUTCMonth() !== today.getUTCMonth() || dob.getUTCDate() !== today.getUTCDate()) {
        throw new ForbiddenException('This coupon is only available on your birthday');
      }
    }

    // Check expiration if any
    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      throw new BadRequestException('This coupon has expired');
    }

    const now = new Date();
    const latestRedemption = await this.prisma.couponRedemption.findFirst({
      where: { userId, couponId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestRedemption) {
      if (coupon.redemptionFrequency === 'ONE_TIME') {
        throw new ConflictException('You have already redeemed this coupon');
      }
      const availableAt = nextRedemptionAt(coupon.redemptionFrequency, latestRedemption.createdAt);
      if (availableAt && now < availableAt) {
        throw new ConflictException(`You can redeem this coupon again after ${availableAt.toISOString()}`);
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

    const redemptionAvailableAt = nextRedemptionAt(coupon.redemptionFrequency, redemption.createdAt);

    return {
      success: true,
      message: 'Coupon redeemed successfully',
      redemptionId: redemption.id,
      redeemedAt: redemption.createdAt,
      redemptionAvailableAt,
      couponCode: coupon.couponCode,
      couponTitle: coupon.title,
      merchantName: coupon.merchant?.name,
    };
  }

  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    await this.prisma.coupon.update({
      where: { id },
      data: { isDeleted: true, status: 'ARCHIVED' },
    });
    await this.syncBirthdayGift(id);

    return { id, deleted: true, softDeleted: true, isDeleted: true, status: 'ARCHIVED' };
  }

  async notifyNearbyUsers(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { merchant: true, area: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    const targetLat = coupon.merchant?.latitude || coupon.area?.latitude;
    const targetLon = coupon.merchant?.longitude || coupon.area?.longitude;

    if (!targetLat || !targetLon) {
      throw new BadRequestException('Merchant or Area location coordinates are missing');
    }

    const allUsers = await this.prisma.user.findMany({
      where: { notificationsPaused: false, fcmToken: { not: null } },
      select: { id: true, fcmToken: true, latitude: true, longitude: true },
    });

    const mLat = Number(targetLat);
    const mLon = Number(targetLon);

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
      return { sent: 0, message: 'No nearby users found with notifications enabled within 3km' };
    }

    const { sendExpoPushMessages } = await import('../notifications/expo-push.util.js');
    const { sendFirebasePushMessages } = await import('../notifications/firebase-push.util.js');

    const notificationTitle = 'Hot Deal Nearby!';
    const notificationBody = `${coupon.title} is just around the corner at ${coupon.merchant?.name || 'a nearby store'}. Tap to grab it now!`;
    const notificationData = {
      sourceType: 'COUPON',
      couponId: coupon.id,
      title: notificationTitle,
      body: notificationBody,
    };

    await this.prisma.notification.createMany({
      data: nearbyUsers.map((user) => ({
        userId: user.id,
        title: notificationTitle,
        body: notificationBody,
        data: notificationData,
      })),
    });

    const messages = nearbyUsers.map((u) => ({
      to: u.fcmToken as string,
      token: u.fcmToken as string,
      title: notificationTitle,
      body: notificationBody,
      data: notificationData,
      channelId: 'deals',
    }));

    const fcmMessages = messages.filter((m) => !m.to.startsWith('ExpoPushToken[') && !m.to.startsWith('ExponentPushToken['));
    const expoMessages = messages.filter((m) => m.to.startsWith('ExpoPushToken[') || m.to.startsWith('ExponentPushToken['));

    if (fcmMessages.length > 0) await sendFirebasePushMessages(fcmMessages);
    if (expoMessages.length > 0) await sendExpoPushMessages(expoMessages);

    return { sent: nearbyUsers.length, message: `Notification sent to ${nearbyUsers.length} user(s) within 3km` };
  }
}
