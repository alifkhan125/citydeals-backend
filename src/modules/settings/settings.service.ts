import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateStoreLinksDto } from './dto/update-store-links.dto.js';
import { UpdateRedemptionRulesDto } from './dto/update-redemption-rules.dto.js';
import {
  DAILY_REDEMPTION_LIMIT_KEY,
  DEFAULT_REDEMPTION_RULES,
  REDEMPTION_COOLDOWN_MINUTES_KEY,
} from './redemption-rules.constants.js';

const PLAY_STORE_KEY = 'playStoreUrl';
const APP_STORE_KEY = 'appStoreUrl';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getStoreLinks() {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: [PLAY_STORE_KEY, APP_STORE_KEY] } },
    });
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    return {
      playStoreUrl:
        values[PLAY_STORE_KEY] ||
        this.config.get<string>('app.playStoreUrl') ||
        'https://play.google.com/store/apps/details?id=com.citydeals.app',
      appStoreUrl:
        values[APP_STORE_KEY] ||
        this.config.get<string>('app.appStoreUrl') ||
        'https://apps.apple.com/',
    };
  }

  async updateStoreLinks(dto: UpdateStoreLinksDto) {
    await this.prisma.$transaction([
      this.prisma.appSetting.upsert({
        where: { key: PLAY_STORE_KEY },
        create: { key: PLAY_STORE_KEY, value: dto.playStoreUrl },
        update: { value: dto.playStoreUrl },
      }),
      this.prisma.appSetting.upsert({
        where: { key: APP_STORE_KEY },
        create: { key: APP_STORE_KEY, value: dto.appStoreUrl },
        update: { value: dto.appStoreUrl },
      }),
    ]);
    return this.getStoreLinks();
  }

  async getRedemptionRules() {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: [REDEMPTION_COOLDOWN_MINUTES_KEY, DAILY_REDEMPTION_LIMIT_KEY] } },
    });
    const values = Object.fromEntries(rows.map((row) => [row.key, Number(row.value)]));
    const cooldownMinutes = Math.max(0, values[REDEMPTION_COOLDOWN_MINUTES_KEY] || 0);
    const dailyLimit = Math.max(0, values[DAILY_REDEMPTION_LIMIT_KEY] || 0);

    return {
      ...DEFAULT_REDEMPTION_RULES,
      cooldownValue: cooldownMinutes % (24 * 60) === 0 ? cooldownMinutes / (24 * 60) : cooldownMinutes / 60,
      cooldownUnit: cooldownMinutes > 0 && cooldownMinutes % (24 * 60) === 0 ? 'DAYS' as const : 'HOURS' as const,
      dailyLimit,
    };
  }

  async updateRedemptionRules(dto: UpdateRedemptionRulesDto) {
    const cooldownMinutes = dto.cooldownValue * (dto.cooldownUnit === 'DAYS' ? 24 * 60 : 60);
    await this.prisma.$transaction([
      this.prisma.appSetting.upsert({
        where: { key: REDEMPTION_COOLDOWN_MINUTES_KEY },
        create: { key: REDEMPTION_COOLDOWN_MINUTES_KEY, value: String(cooldownMinutes) },
        update: { value: String(cooldownMinutes) },
      }),
      this.prisma.appSetting.upsert({
        where: { key: DAILY_REDEMPTION_LIMIT_KEY },
        create: { key: DAILY_REDEMPTION_LIMIT_KEY, value: String(dto.dailyLimit) },
        update: { value: String(dto.dailyLimit) },
      }),
    ]);
    return this.getRedemptionRules();
  }
}
