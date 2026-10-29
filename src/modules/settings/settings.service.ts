import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateStoreLinksDto } from './dto/update-store-links.dto.js';

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
}
