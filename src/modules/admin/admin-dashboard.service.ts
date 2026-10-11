import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [stats, trending, areaRedemptions, dailyRedemptions] = await Promise.all([
      this.stats(),
      this.trendingCoupons(),
      this.redemptionsByArea(),
      this.dailyRedemptions(),
    ]);

    return { stats, trending, areaRedemptions, dailyRedemptions };
  }

  async stats() {
    const [businesses, registeredUsers, coupons, liveCoupons, couponsSaved, redemptions] = await Promise.all([
      this.prisma.merchant.count(),
      this.prisma.user.count(),
      this.prisma.coupon.count(),
      this.prisma.coupon.count({ where: { status: 'ACTIVE' } }),
      this.prisma.savedCoupon.count(),
      this.prisma.couponRedemption.count(),
    ]);
    return { businesses, registeredUsers, coupons, liveCoupons, couponsSaved, redemptions };
  }

  async dailyRedemptions() {
    const rows = await this.prisma.couponRedemption.groupBy({
      by: ['createdAt'],
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows.map((row) => ({ time: row.createdAt, count: row._count.id }));
  }

  async redemptionsByArea() {
    const areas = await this.prisma.area.findMany({
      include: { coupons: { include: { _count: { select: { redemptions: true } } } } },
      orderBy: { name: 'asc' },
    });
    return areas.map((area) => ({
      areaId: area.id,
      areaName: area.name,
      redemptions: area.coupons.reduce((sum, coupon) => sum + coupon._count.redemptions, 0),
    }));
  }

  trendingCoupons() {
    return this.prisma.coupon.findMany({
      include: {
        merchant: true,
        category: true,
        _count: { select: { savedBy: true, redemptions: true } },
      },
      orderBy: [{ savedBy: { _count: 'desc' } }, { redemptions: { _count: 'desc' } }],
      take: 10,
    });
  }
}
