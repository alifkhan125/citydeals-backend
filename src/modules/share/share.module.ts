import { Module } from '@nestjs/common';
import { ShareController } from './share.controller.js';
import { ShareService } from './share.service.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  controllers: [ShareController],
  providers: [ShareService],
})
export class ShareModule {}
