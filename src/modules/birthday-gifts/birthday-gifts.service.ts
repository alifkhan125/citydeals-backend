import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateBirthdayGiftDto } from './dto/create-birthday-gift.dto.js';

const giftInclude = {
  merchant: { select: { id: true, name: true, logoUrl: true, address: true } },
  coupon: { select: { id: true, title: true, couponCode: true, terms: true } },
  _count: { select: { claims: true } },
} as const;

function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function daysUntilBirthday(dateOfBirth: Date | null, now = new Date()) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let nextBirthday = Date.UTC(now.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate());
  if (nextBirthday < today) nextBirthday = Date.UTC(now.getUTCFullYear() + 1, dob.getUTCMonth(), dob.getUTCDate());
  return Math.floor((nextBirthday - today) / 86_400_000);
}

@Injectable()
export class BirthdayGiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(query: { search?: string; status?: string; merchantId?: string; page?: number; limit?: number }) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 25), 1), 100);
    const search = query.search?.trim();
    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.merchantId ? { merchantId: query.merchantId } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { merchant: { name: { contains: search, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.birthdayGift.findMany({ where, include: giftInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.birthdayGift.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(dto: CreateBirthdayGiftDto) {
    const merchant = await this.prisma.merchant.findFirst({ where: { id: dto.merchantId, isDeleted: false } });
    if (!merchant) throw new NotFoundException('Business not found');
    if (dto.couponId) {
      const coupon = await this.prisma.coupon.findFirst({ where: { id: dto.couponId, merchantId: dto.merchantId, isDeleted: false } });
      if (!coupon) throw new BadRequestException('Coupon does not belong to this business');
    }
    return this.prisma.birthdayGift.create({ data: { ...dto, status: dto.status as any ?? 'ACTIVE', startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined }, include: giftInclude });
  }

  async update(id: string, dto: Partial<CreateBirthdayGiftDto>) {
    const existing = await this.prisma.birthdayGift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Birthday gift not found');
    return this.prisma.birthdayGift.update({ where: { id }, data: { ...dto, status: dto.status as any, startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined }, include: giftInclude });
  }

  async remove(id: string) {
    await this.prisma.birthdayGift.update({ where: { id }, data: { status: 'INACTIVE' } });
    return { deleted: true, softDeleted: true };
  }

  async available(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('Active account required');
    const now = new Date();
    const gifts = await this.prisma.birthdayGift.findMany({ where: { status: 'ACTIVE', AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }] }, include: giftInclude, orderBy: { createdAt: 'desc' } });
    const year = now.getUTCFullYear();
    const claims = await this.prisma.birthdayClaim.findMany({ where: { userId, birthdayYear: year }, select: { giftId: true, status: true } });
    const claimMap = new Map(claims.map((claim) => [claim.giftId, claim.status]));
    const days = daysUntilBirthday(user.dateOfBirth, now);
    const birthdayEligible = days === 0;
    const withinBirthdayWindow = days !== null && days <= 7;
    return { isBirthday: birthdayEligible, daysUntilBirthday: days, birthdayYear: year, items: withinBirthdayWindow ? gifts.map((gift) => ({ ...gift, claimStatus: claimMap.get(gift.id) ?? null })) : [] };
  }

  async getMine(userId: string) {
    const claims = await this.prisma.birthdayClaim.findMany({ where: { userId }, include: { gift: { include: giftInclude } }, orderBy: { createdAt: 'desc' } });
    return claims.map(({ claimCodeHash: _claimCodeHash, ...claim }) => claim);
  }

  async claim(userId: string, giftId: string) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('Active account required');
    if (daysUntilBirthday(user.dateOfBirth, now) !== 0) throw new BadRequestException('Birthday gift can only be claimed on your birthday');
    const gift = await this.prisma.birthdayGift.findFirst({ where: { id: giftId, status: 'ACTIVE', AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }] }, include: giftInclude });
    if (!gift) throw new NotFoundException('Birthday gift is not available');
    const existing = await this.prisma.birthdayClaim.findUnique({ where: { userId_giftId_birthdayYear: { userId, giftId, birthdayYear: year } }, include: { gift: { include: giftInclude } } });
    if (existing) {
      const { claimCodeHash: _claimCodeHash, ...safeClaim } = existing;
      return { alreadyClaimed: true, claim: safeClaim };
    }
    if (gift.claimLimit != null) {
      const count = await this.prisma.birthdayClaim.count({ where: { giftId, birthdayYear: year, status: { in: ['CLAIMED', 'REDEEMED'] } } });
      if (count >= gift.claimLimit) throw new ConflictException('This birthday gift has reached its claim limit');
    }
    const claimCode = `BD-${randomBytes(5).toString('hex').toUpperCase()}`;
    const claim = await this.prisma.birthdayClaim.create({ data: { userId, giftId, birthdayYear: year, claimCodeHash: hashCode(claimCode) }, include: { gift: { include: giftInclude } } });
    const { claimCodeHash: _claimCodeHash, ...safeClaim } = claim;
    return { alreadyClaimed: false, claim: { ...safeClaim, claimCode } };
  }

  async validate(user: { id: string; role: string; areaId?: string | null }, claimCode: string, merchantId: string) {
    const claim = await this.prisma.birthdayClaim.findUnique({ where: { claimCodeHash: hashCode(claimCode) }, include: { gift: true, user: { select: { id: true, fullName: true, email: true } } } });
    if (!claim) throw new NotFoundException('Claim code not found');
    if (claim.gift.merchantId !== merchantId) throw new ForbiddenException('This gift belongs to another business');
    if (user.role !== 'ADMIN') {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { areaId: true } });
      if (!merchant || merchant.areaId !== user.areaId) throw new ForbiddenException('Cannot validate outside your area');
    }
    if (claim.status !== 'CLAIMED') throw new ConflictException(`Claim is already ${claim.status.toLowerCase()}`);
    const updated = await this.prisma.birthdayClaim.update({ where: { id: claim.id }, data: { status: 'REDEEMED', redeemedAt: new Date(), validatedBy: user.id } });
    return { valid: true, claim: { id: updated.id, status: updated.status, redeemedAt: updated.redeemedAt, user: claim.user } };
  }
}
