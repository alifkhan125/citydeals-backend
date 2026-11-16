import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BirthdayGiftsController } from './birthday-gifts.controller.js';
import { BirthdayGiftsService } from './birthday-gifts.service.js';

@Module({ imports: [PassportModule.register({ defaultStrategy: 'jwt' })], controllers: [BirthdayGiftsController], providers: [BirthdayGiftsService, StaffPermissionGuard, PrismaService], exports: [BirthdayGiftsService] })
export class BirthdayGiftsModule {}
