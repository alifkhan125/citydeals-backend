import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import appConfig from './config/app.config.js';
import authConfig from './config/auth.config.js';
import redisConfig from './config/redis.config.js';
import mailConfig from './config/mail.config.js';
import cloudinaryConfig from './config/cloudinary.config.js';
import { PrismaModule } from './database/prisma.module.js';
import { UploadModule } from './modules/upload/upload.module.js';
import { AreasModule } from './modules/areas/areas.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { CouponsModule } from './modules/coupons/coupons.module.js';
import { LocationModule } from './modules/location/location.module.js';
import { LegalModule } from './modules/legal/legal.module.js';
import { MerchantsModule } from './modules/merchants/merchants.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { QrModule } from './modules/qr/qr.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { ShareModule } from './modules/share/share.module.js';
import { SupportModule } from './modules/support/support.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, redisConfig, mailConfig, cloudinaryConfig],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
        },
      }),
    }),
    PrismaModule,
    UploadModule,
    AdminModule,
    AuthModule,
    MailModule,
    AreasModule,
    MerchantsModule,
    CouponsModule,
    CategoriesModule,
    SearchModule,
    UsersModule,
    SupportModule,
    LegalModule,
    QrModule,
    ShareModule,
    LocationModule,
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
