import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class ShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  async getCouponOpenPage(shareSlug: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { shareSlug },
      select: { title: true, description: true, imageUrl: true, status: true, isDeleted: true },
    });
    if (!coupon || coupon.isDeleted || coupon.status !== 'ACTIVE') {
      throw new NotFoundException('Coupon not found');
    }

    const stores = await this.settingsService.getStoreLinks();
    return { coupon, stores };
  }

  async getCouponShareData(shareSlug: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { shareSlug },
      include: { merchant: true, area: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const baseUrl = this.configService.get<string>('app.publicBaseUrl');
    const title = `${coupon.title} at ${coupon.merchant.name}`;
    const description = coupon.description;
    const image = coupon.imageUrl ?? `${baseUrl}/og/default-coupon.png`;

    return {
      shareUrl: `${baseUrl}/c/${shareSlug}`,
      title,
      description,
      image,
      coupon,
      links: {
        coupon: `${baseUrl}/coupons/public/${coupon.shareSlug}`,
        directory: `${baseUrl}/directory/${coupon.area.slug}`,
      },
      socialPreview: {
        ogTitle: title,
        ogDescription: description,
        ogImage: image,
        ogUrl: `${baseUrl}/c/${shareSlug}`,
      },
    };
  }

  async trackCouponShare(
    shareSlug: string,
    body: { channel?: string; eventType?: 'SHARE' | 'OPEN' },
  ) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { shareSlug },
      select: { id: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const channel = (body.channel || 'SYSTEM').trim().toUpperCase();
    const eventType = body.eventType === 'OPEN' ? 'OPEN' : 'SHARE';

    await this.prisma.couponShareEvent.create({
      data: {
        couponId: coupon.id,
        channel,
        eventType,
      },
    });

    return { ok: true };
  }
}
