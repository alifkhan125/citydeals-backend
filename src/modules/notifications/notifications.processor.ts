import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import { PROXIMITY_QUEUE } from './notifications.service.js';
import { SendNotificationDto } from './dto/send-notification.dto.js';
import { sendExpoPushMessages } from './expo-push.util.js';
import { sendFirebasePushMessages } from './firebase-push.util.js';

const COOLDOWN_MS = 60 * 1000; // 1 minute for testing

@Injectable()
@Processor(PROXIMITY_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name === 'send-grouped-proximity') {
      return this.processGrouped(job);
    }

    const { userId, merchantId } = job.data;
    if (!userId || !merchantId) return { skipped: true, reason: 'missing_proximity_target' };
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationsPaused: true, fcmToken: true },
    });
    if (!user) return { skipped: true, reason: 'user_not_found' };
    if (user.notificationsPaused) return { skipped: true, reason: 'notifications_paused' };

    const cooldown = await this.prisma.notificationCooldown.findUnique({
      where: { userId_merchantId: { userId, merchantId } },
    });
    if (cooldown && Date.now() - cooldown.lastSentAt.getTime() < COOLDOWN_MS) return { skipped: true };

    await this.prisma.notificationCooldown.upsert({
      where: { userId_merchantId: { userId, merchantId } },
      update: { lastSentAt: new Date() },
      create: { userId, merchantId, lastSentAt: new Date() },
    });
    await this.prisma.notification.create({
      data: {
        userId,
        title: job.data.title,
        body: job.data.body,
        data: { sourceType: 'MERCHANT', merchantId },
      },
    });
    const token = user.fcmToken ?? '';
    const push = token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[')
      ? await sendExpoPushMessages([
          {
            to: token,
            title: job.data.title,
            body: job.data.body,
            data: { sourceType: 'MERCHANT', merchantId },
            channelId: 'deals',
          },
        ])
      : await sendFirebasePushMessages([
          {
            token,
            title: job.data.title,
            body: job.data.body,
            data: { sourceType: 'MERCHANT', merchantId },
          },
        ]);
    return { sent: true, push };
  }

  private async processGrouped(job: Job<any>) {
    const { userId, merchantIds, totalCoupons } = job.data;
    if (!userId || !merchantIds || merchantIds.length === 0) return { skipped: true, reason: 'missing_targets' };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationsPaused: true, fcmToken: true },
    });
    if (!user) return { skipped: true, reason: 'user_not_found' };
    if (user.notificationsPaused) return { skipped: true, reason: 'notifications_paused' };

    const cooldowns = await this.prisma.notificationCooldown.findMany({
      where: { userId, merchantId: { in: merchantIds } },
    });
    
    const now = Date.now();
    const cooledDownMerchantIds = new Set(
      cooldowns.filter((c: any) => now - c.lastSentAt.getTime() < COOLDOWN_MS).map((c: any) => c.merchantId)
    );

    const validMerchantIds = merchantIds.filter((id: string) => !cooledDownMerchantIds.has(id));
    if (validMerchantIds.length === 0) return { skipped: true, reason: 'all_cooldown' };

    // Set new cooldowns
    await Promise.all(
      validMerchantIds.map((merchantId: string) =>
        this.prisma.notificationCooldown.upsert({
          where: { userId_merchantId: { userId, merchantId } },
          update: { lastSentAt: new Date() },
          create: { userId, merchantId, lastSentAt: new Date() },
        })
      )
    );

    const title = 'New Deals Nearby!';
    const body = `We found ${totalCoupons} active coupons from ${validMerchantIds.length} restaurants near your location. Tap to view!`;

    await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        data: { sourceType: 'NEARBY_DEALS', grouped: 'true', merchantIds: validMerchantIds },
      },
    });

    const token = user.fcmToken ?? '';
    if (!token) return { skipped: false, push: null };

    const push = token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[')
      ? await sendExpoPushMessages([
          { to: token, title, body, data: { sourceType: 'NEARBY_DEALS', grouped: true }, channelId: 'deals' },
        ])
      : await sendFirebasePushMessages([
          { token, title, body, data: { sourceType: 'NEARBY_DEALS', grouped: true } },
        ]);
        
    return { sent: true, push };
  }
}
