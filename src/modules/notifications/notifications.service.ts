import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { haversineDistanceMeters } from '../../common/utils/geo.util.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { SendNotificationDto } from './dto/send-notification.dto.js';
import { UpdateBirthdaySettingsDto } from './dto/birthday-settings.dto.js';
import { sendExpoPushMessages } from './expo-push.util.js';
import { sendFirebasePushMessages } from './firebase-push.util.js';

export const PROXIMITY_QUEUE = 'proximity-notifications';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private birthdaySettingsPath = path.resolve(process.cwd(), 'data', 'birthday-settings.json');
  private cachedBirthdaySettings = {
    enabled: true,
    category: 'Restaurant',
    leadTime: 'On birthday',
    lastRunAt: null as string | null,
  };

  constructor(
    @InjectQueue(PROXIMITY_QUEUE) private readonly queue: Queue<any>,
    private readonly prisma: PrismaService,
  ) { }

  onModuleInit() {
    this.loadBirthdaySettings();
    // Schedule initial birthday check after 10s and periodic check every 12 hours
    setTimeout(() => {
      this.checkAndSendBirthdayNotifications().catch((err) =>
        this.logger.error('Initial birthday perks check failed:', err),
      );
    }, 10000);

    setInterval(() => {
      this.checkAndSendBirthdayNotifications().catch((err) =>
        this.logger.error('Periodic birthday perks check failed:', err),
      );
    }, 12 * 60 * 60 * 1000);
  }

  private loadBirthdaySettings() {
    try {
      if (fs.existsSync(this.birthdaySettingsPath)) {
        const raw = fs.readFileSync(this.birthdaySettingsPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.cachedBirthdaySettings = { ...this.cachedBirthdaySettings, ...parsed };
      }
    } catch (err: any) {
      this.logger.warn(`Could not load birthday settings from disk: ${err.message}`);
    }
  }

  private saveBirthdaySettings() {
    try {
      const dir = path.dirname(this.birthdaySettingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.birthdaySettingsPath, JSON.stringify(this.cachedBirthdaySettings, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Could not save birthday settings to disk: ${err.message}`);
    }
  }

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

    const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours between proximity alerts
    const now = Date.now();
    const cooldownCutoff = new Date(now - COOLDOWN_MS);
    const validMerchantIds: string[] = [];

    // Claim each merchant atomically. Concurrent location syncs can then only
    // let one request send the proximity alert for a merchant.
    for (const merchantId of [...new Set(merchantIds)]) {
      const claimed = await this.prisma.notificationCooldown.updateMany({
        where: {
          userId,
          merchantId,
          lastSentAt: { lt: cooldownCutoff },
        },
        data: { lastSentAt: new Date(now) },
      });

      if (claimed.count === 1) {
        validMerchantIds.push(merchantId);
        continue;
      }

      try {
        await this.prisma.notificationCooldown.create({
          data: { userId, merchantId, lastSentAt: new Date(now) },
        });
        validMerchantIds.push(merchantId);
      } catch {
        // Another concurrent request created the cooldown first.
      }
    }

    if (validMerchantIds.length === 0) {
      console.log(`[Push] All merchants on cooldown`);
      return;
    }

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

  getBirthdaySettings() {
    return this.cachedBirthdaySettings;
  }

  async updateBirthdaySettings(dto: UpdateBirthdaySettingsDto) {
    this.cachedBirthdaySettings = {
      ...this.cachedBirthdaySettings,
      enabled: dto.enabled,
      category: dto.category,
      leadTime: dto.leadTime,
    };
    this.saveBirthdaySettings();

    // Trigger birthday checks immediately if enabled so changes take effect
    let checkResult: any = null;
    if (this.cachedBirthdaySettings.enabled) {
      checkResult = await this.checkAndSendBirthdayNotifications().catch((err) => {
        this.logger.error('Failed to run birthday check after update:', err);
        return { error: err.message };
      });
    }

    return {
      settings: this.cachedBirthdaySettings,
      checkResult,
    };
  }

  async checkAndSendBirthdayNotifications() {
    if (!this.cachedBirthdaySettings.enabled) {
      return { skipped: true, reason: 'Birthday perks disabled' };
    }

    let leadDays = 0;
    if (this.cachedBirthdaySettings.leadTime === '1 day before') {
      leadDays = 1;
    } else if (this.cachedBirthdaySettings.leadTime === '7 days before') {
      leadDays = 7;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + leadDays);
    const targetMonth = targetDate.getMonth();
    const targetDay = targetDate.getDate();

    const users = await this.prisma.user.findMany({
      where: {
        dateOfBirth: { not: null },
        notificationsPaused: false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        dateOfBirth: true,
        fcmToken: true,
      },
    });

    const matchedUsers = users.filter((u) => {
      if (!u.dateOfBirth) return false;
      const dob = new Date(u.dateOfBirth);
      return dob.getMonth() === targetMonth && dob.getDate() === targetDay;
    });

    if (matchedUsers.length === 0) {
      this.cachedBirthdaySettings.lastRunAt = new Date().toISOString();
      this.saveBirthdaySettings();
      return { checkedUsers: users.length, matchedUsers: 0, sent: 0 };
    }

    // Filter out users who already received a birthday notification in current calendar year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const recentBirthdayNotifications = await this.prisma.notification.findMany({
      where: {
        userId: { in: matchedUsers.map((u) => u.id) },
        createdAt: { gte: startOfYear },
      },
      select: { userId: true, data: true },
    });

    const alreadyNotifiedUserIds = new Set(
      recentBirthdayNotifications
        .filter((n) => (n.data as any)?.sourceType === 'BIRTHDAY')
        .map((n) => n.userId),
    );

    const eligibleUsers = matchedUsers.filter((u) => !alreadyNotifiedUserIds.has(u.id));

    if (eligibleUsers.length === 0) {
      this.cachedBirthdaySettings.lastRunAt = new Date().toISOString();
      this.saveBirthdaySettings();
      return { checkedUsers: users.length, matchedUsers: matchedUsers.length, eligibleUsers: 0, sent: 0 };
    }

    const title = leadDays === 0
      ? '🎉 Happy Birthday from CityDeals!'
      : '🎂 Birthday Coming Soon! Special Perks For You';
    const body = leadDays === 0
      ? `Happy Birthday! Enjoy special ${this.cachedBirthdaySettings.category} perks and exclusive deals just for you today!`
      : `Your birthday is in ${leadDays} day${leadDays > 1 ? 's' : ''}! Check out exclusive ${this.cachedBirthdaySettings.category} perks waiting for you.`;

    await this.prisma.notification.createMany({
      data: eligibleUsers.map((u) => ({
        userId: u.id,
        title,
        body,
        data: {
          sourceType: 'BIRTHDAY',
          category: this.cachedBirthdaySettings.category,
          leadDays,
        },
      })),
    });

    const pushResult = await this.sendPushNotifications(eligibleUsers, {
      title,
      body,
      sendTo: 'ALL',
    });

    this.cachedBirthdaySettings.lastRunAt = new Date().toISOString();
    this.saveBirthdaySettings();

    this.logger.log(`Birthday perks check complete: sent to ${eligibleUsers.length} users`);
    return {
      checkedUsers: users.length,
      matchedUsers: matchedUsers.length,
      eligibleUsers: eligibleUsers.length,
      push: pushResult,
    };
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

  private async resolveRecipients(dto: SendNotificationDto) {
    if (dto.sendTo === 'USER' && dto.userId) {
      return this.prisma.user.findMany({
        where: { id: dto.userId, notificationsPaused: false },
        select: { id: true, fcmToken: true },
      });
    }

    if (dto.sendTo === 'AREA' && dto.areaId) {
      const targetArea = await this.prisma.area.findUnique({
        where: { id: dto.areaId },
      });

      if (!targetArea) {
        return this.prisma.user.findMany({
          where: { areaId: dto.areaId, notificationsPaused: false },
          select: { id: true, fcmToken: true },
        });
      }

      // Match area by ID, or sibling areas with same base name (e.g. "Aqua Tower", "Aqua Tower 2", etc.)
      const baseName = targetArea.name.split(' ')[0] || targetArea.name;
      const matchingAreas = await this.prisma.area.findMany({
        where: {
          OR: [
            { id: dto.areaId },
            { name: { contains: baseName, mode: 'insensitive' } },
            { city: { equals: targetArea.city, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true },
      });
      const matchingAreaIds = new Set(
        matchingAreas
          .filter((a) => a.id === dto.areaId || a.name.toLowerCase().startsWith(baseName.toLowerCase()))
          .map((a) => a.id),
      );

      const targetLat = Number(targetArea.latitude);
      const targetLon = Number(targetArea.longitude);
      const targetRadius = targetArea.radiusMeters || 15000;

      const candidateUsers = await this.prisma.user.findMany({
        where: { notificationsPaused: false },
        select: { id: true, fcmToken: true, areaId: true, latitude: true, longitude: true },
      });

      const matched = candidateUsers.filter((u) => {
        // Direct or sibling area assignment
        if (u.areaId && matchingAreaIds.has(u.areaId)) return true;
        // Geographic coordinate check
        if (u.latitude != null && u.longitude != null) {
          const dist = haversineDistanceMeters(
            { latitude: Number(u.latitude), longitude: Number(u.longitude) },
            { latitude: targetLat, longitude: targetLon },
          );
          return dist <= targetRadius;
        }
        return false;
      });

      if (matched.length > 0) {
        return matched.map((u) => ({ id: u.id, fcmToken: u.fcmToken }));
      }

      // Fallback: If no users matched geographically or by areaId,
      // match all active non-paused users who have a device token
      return candidateUsers
        .filter((u) => Boolean(u.fcmToken?.trim()))
        .map((u) => ({ id: u.id, fcmToken: u.fcmToken }));
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
    const sourceType = dto.merchantId
      ? 'MERCHANT'
      : dto.areaId
        ? 'AREA'
        : dto.userId
          ? 'USER'
          : 'BROADCAST';
    const usersWithTokens = Array.from(
      new Map(
        users
          .filter((user) => user.fcmToken?.trim())
          .map((user) => [user.fcmToken!.trim(), user]),
      ).values(),
    );
    const missingTokens = users.length - usersWithTokens.length;
    const messages = usersWithTokens.map((user) => ({
      token: user.fcmToken!.trim(),
      to: user.fcmToken!.trim(),
      title: dto.title,
      body: dto.body,
      data: {
        sourceType,
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
      const staleTokens = fcm.failures
        ?.filter((failure) => /notregistered|registration-token-not-registered/i.test(failure.message))
        .map((failure) => fcmMessages[failure.index]?.token)
        .filter(Boolean) as string[] | undefined;
      if (staleTokens?.length) {
        await this.prisma.user.updateMany({
          where: { fcmToken: { in: staleTokens } },
          data: { fcmToken: null },
        });
      }
      return {
        sent: fcm.sent + expo.sent,
        skipped: missingTokens + fcm.skipped + expo.skipped,
        totalRecipients: users.length,
        usersWithTokens: usersWithTokens.length,
        missingTokens,
        fcm,
        expo,
      };
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : String(error));
      return {
        sent: 0,
        skipped: users.length,
        totalRecipients: users.length,
        usersWithTokens: usersWithTokens.length,
        missingTokens,
        error: error instanceof Error ? error.message : String(error),
      };
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
