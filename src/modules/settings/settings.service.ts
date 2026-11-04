import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateStoreLinksDto } from './dto/update-store-links.dto.js';
import { UpdateRedemptionRulesDto } from './dto/update-redemption-rules.dto.js';
import {
  DEFAULT_REDEMPTION_RULES,
  REDEMPTION_COOLDOWN_MINUTES_KEY,
} from './redemption-rules.constants.js';

const PLAY_STORE_KEY = 'playStoreUrl';
const APP_STORE_KEY = 'appStoreUrl';
const BASE_URL_KEY = 'baseUrl';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getStoreLinks() {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: [PLAY_STORE_KEY, APP_STORE_KEY, BASE_URL_KEY, 'mainUrl'] } },
    });
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    return {
      baseUrl: values[BASE_URL_KEY] || values.mainUrl || 'https://citydeals.app',
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
        where: { key: BASE_URL_KEY },
        create: { key: BASE_URL_KEY, value: dto.baseUrl },
        update: { value: dto.baseUrl },
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
      where: { key: REDEMPTION_COOLDOWN_MINUTES_KEY },
    });
    const values = Object.fromEntries(rows.map((row) => [row.key, Number(row.value)]));
    const cooldownMinutes = Math.max(0, values[REDEMPTION_COOLDOWN_MINUTES_KEY] || 0);

    const unit = cooldownMinutes > 0 && cooldownMinutes % (30 * 24 * 60) === 0
      ? 'MONTHLY' as const
      : cooldownMinutes > 0 && cooldownMinutes % (7 * 24 * 60) === 0
        ? 'WEEKLY' as const
        : 'DAILY' as const;
    const unitMinutes = unit === 'MONTHLY'
      ? 30 * 24 * 60
      : unit === 'WEEKLY'
        ? 7 * 24 * 60
          : 24 * 60;

    return {
      ...DEFAULT_REDEMPTION_RULES,
      cooldownValue: cooldownMinutes > 0 ? Math.max(1, Math.round(cooldownMinutes / unitMinutes)) : 0,
      cooldownUnit: unit,
    };
  }

  async updateRedemptionRules(dto: UpdateRedemptionRulesDto) {
    const cooldownMinutes = dto.cooldownValue * (
      dto.cooldownUnit === 'MONTHLY'
        ? 30 * 24 * 60
        : dto.cooldownUnit === 'WEEKLY'
          ? 7 * 24 * 60
            : 24 * 60
    );
    await this.prisma.$transaction([
      this.prisma.appSetting.upsert({
        where: { key: REDEMPTION_COOLDOWN_MINUTES_KEY },
        create: { key: REDEMPTION_COOLDOWN_MINUTES_KEY, value: String(cooldownMinutes) },
        update: { value: String(cooldownMinutes) },
      }),
    ]);
    return this.getRedemptionRules();
  }
}
