import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { SendNotificationDto } from './dto/send-notification.dto.js';
import { sendExpoPushMessages } from './expo-push.util.js';
import { sendFirebasePushMessages } from './firebase-push.util.js';

export const PROXIMITY_QUEUE = 'proximity-notifications';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(PROXIMITY_QUEUE) private readonly queue: Queue<any>,
    private readonly prisma: PrismaService,
  ) {}

  enqueueProximityNotification(dto: SendNotificationDto & { userId: string; merchantId: string }) {
    return this.queue.add('send-proximity', dto, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }

  async sendGroupedProximityNotificationSync(userId: string, merchantIds: string[], totalCoupons: number) {
    console.log(`[Push] Starting sync push for user: ${userId}, merchants: ${merchantIds.length}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationsPaused: true, fcmToken: true },
    });
    if (!user) {
      console.log(`[Push] User not found`);
      return;
    }
    if (user.notificationsPaused) {
      console.log(`[Push] User notifications paused`);
      return;
    }

    const cooldowns = await this.prisma.notificationCooldown.findMany({
      where: { userId, merchantId: { in: merchantIds } },
    });
    
    const COOLDOWN_MS = 60 * 1000; // 1 minute
    const now = Date.now();
    const cooledDownMerchantIds = new Set(
      cooldowns.filter((c) => now - c.lastSentAt.getTime() < COOLDOWN_MS).map((c) => c.merchantId)
    );

    const validMerchantIds = merchantIds.filter((id) => !cooledDownMerchantIds.has(id));
    if (validMerchantIds.length === 0) {
      console.log(`[Push] All merchants on cooldown`);
      return;
    }

    // Set new cooldowns
    await Promise.all(
      validMerchantIds.map((merchantId) =>
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
    if (!token) {
      console.log(`[Push] User missing FCM token`);
      return;
    }

    console.log(`[Push] Sending to token: ${token}`);
    try {
      if (token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[')) {
        await sendExpoPushMessages([
          { to: token, title, body, data: { sourceType: 'NEARBY_DEALS', grouped: true }, channelId: 'deals' },
        ]);
      } else {
        await sendFirebasePushMessages([
          { token, title, body, data: { sourceType: 'NEARBY_DEALS', grouped: true } },
        ]);
      }
      console.log(`[Push] Push sent successfully!`);
    } catch (err: any) {
      console.log(`[Push] Failed to send push:`, err.message);
    }
  }

  async send(dto: SendNotificationDto) {
    const users = await this.resolveRecipients(dto);
    const notifications = await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title: dto.title,
        body: dto.body,
        data: {
          sourceType: dto.merchantId
            ? 'MERCHANT'
            : dto.areaId
              ? 'AREA'
              : dto.userId
                ? 'USER'
                : 'BROADCAST',
          sendTo: dto.sendTo ?? 'ALL',
          areaId: dto.areaId,
          scheduledAt: dto.scheduledAt,
          repeat: dto.repeat ?? 'NONE',
        },
      })),
    });

    const push = await this.sendPushNotifications(users, dto);
    return { recipients: users.length, created: notifications.count, push };
  }

  private resolveRecipients(dto: SendNotificationDto) {
    if (dto.sendTo === 'USER' && dto.userId) {
      return this.prisma.user.findMany({
        where: { id: dto.userId, notificationsPaused: false },
        select: { id: true, fcmToken: true },
      });
    }
    if (dto.sendTo === 'AREA' && dto.areaId) {
      return this.prisma.user.findMany({
        where: { areaId: dto.areaId, notificationsPaused: false },
        select: { id: true, fcmToken: true },
      });
    }
    return this.prisma.user.findMany({
      where: { notificationsPaused: false },
      select: { id: true, fcmToken: true },
    });
  }

  private async sendPushNotifications(
    users: Array<{ id: string; fcmToken: string | null }>,
    dto: SendNotificationDto,
  ) {
    const messages = users.map((user) => ({
      token: user.fcmToken ?? '',
      to: user.fcmToken ?? '',
      title: dto.title,
      body: dto.body,
      data: {
        sourceType: dto.merchantId
          ? 'MERCHANT'
          : dto.areaId
            ? 'AREA'
            : dto.userId
              ? 'USER'
              : 'BROADCAST',
        sendTo: dto.sendTo ?? 'ALL',
        areaId: dto.areaId,
        userId: dto.userId,
        merchantId: dto.merchantId,
      },
      channelId: 'deals',
    }));

    try {
      const fcmMessages = messages.filter((message) => !message.to.startsWith('ExpoPushToken[') && !message.to.startsWith('ExponentPushToken['));
      const expoMessages = messages.filter((message) => message.to.startsWith('ExpoPushToken[') || message.to.startsWith('ExponentPushToken['));
      const [fcm, expo] = await Promise.all([
        sendFirebasePushMessages(fcmMessages),
        sendExpoPushMessages(expoMessages),
      ]);
      return {
        sent: fcm.sent + expo.sent,
        skipped: fcm.skipped + expo.skipped,
        fcm,
        expo,
      };
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : String(error));
      return { sent: 0, skipped: users.length };
    }
  }

  async findMine(userId: string, query: ListNotificationsDto) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50);
    const readFilter = query.read === undefined ? undefined : query.read === 'true';
    const where = {
      userId,
      readAt: readFilter === undefined ? undefined : readFilter ? { not: null } : null,
    };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount } };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async findAllAdmin(query?: { search?: string }) {
    const where: any = {};
    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { body: { contains: term, mode: 'insensitive' } },
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              area: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total };
  }
}
