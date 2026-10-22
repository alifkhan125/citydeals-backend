import { Injectable } from '@nestjs/common';
import { haversineDistanceMeters } from '../../common/utils/geo.util.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AreasService } from '../areas/areas.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SyncLocationDto } from '../auth/dto/sync-location.dto.js';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly areasService: AreasService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sync(user: { id: string }, dto: SyncLocationDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationRadiusMeters: true },
    });
    const area = await this.areasService.resolveArea(dto.latitude, dto.longitude);
    const merchants = area
      ? await this.prisma.merchant.findMany({
          where: { areaId: area.id, status: 'ACTIVE', isDeleted: false },
          include: { area: true, coupons: { where: { status: 'ACTIVE', isDeleted: false } } },
        })
      : [];

    const nearbyMerchants = merchants
      .map((merchant) => ({
        ...merchant,
        distanceMeters: haversineDistanceMeters(
          { latitude: dto.latitude, longitude: dto.longitude },
          {
            latitude: Number(merchant.latitude ?? merchant.area.latitude),
            longitude: Number(merchant.longitude ?? merchant.area.longitude),
          },
        ),
      }))
      .filter(
        (merchant) =>
          merchant.distanceMeters <= merchant.radiusMeters &&
          merchant.distanceMeters <= (currentUser?.notificationRadiusMeters ?? 2000) &&
          merchant.coupons.length > 0,
      );

    console.log(`Found ${nearbyMerchants.length} nearby merchants out of ${merchants.length} total merchants in area`);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { latitude: dto.latitude, longitude: dto.longitude, fcmToken: dto.fcmToken, areaId: area?.id },
    });

    if (nearbyMerchants.length > 0) {
      const merchantIds = nearbyMerchants.map((m) => m.id);
      const totalCoupons = nearbyMerchants.reduce((sum, m) => sum + m.coupons.length, 0);
      
      console.log(`Sending proximity notification synchronously for user ${user.id} with ${merchantIds.length} merchants and ${totalCoupons} coupons`);
      await this.notificationsService.sendGroupedProximityNotificationSync(
        user.id,
        merchantIds,
        totalCoupons,
      );
    } else {
      console.log(`No nearby active merchants found for user ${user.id}`);
    }

    return {
      area,
      geofences: merchants.map((merchant) => ({
        merchantId: merchant.id,
        latitude: merchant.area.latitude,
        longitude: merchant.area.longitude,
        radiusMeters: merchant.area.radiusMeters,
      })),
    };
  }
}
