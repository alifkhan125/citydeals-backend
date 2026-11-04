import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { BirthdayGiftsService } from './birthday-gifts.service.js';
import { CreateBirthdayGiftDto } from './dto/create-birthday-gift.dto.js';
import { ValidateBirthdayClaimDto } from './dto/validate-birthday-claim.dto.js';

@ApiTags('Birthday Gifts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('birthday-gifts')
export class BirthdayGiftsController {
  constructor(private readonly service: BirthdayGiftsService) {}

  @Get('available') available(@GetUser() user: { id: string }) { return this.service.available(user.id); }
  @Get('my-claims') mine(@GetUser() user: { id: string }) { return this.service.getMine(user.id); }
  @Post(':id/claim') claim(@GetUser() user: { id: string }, @Param('id') id: string) { return this.service.claim(user.id, id); }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADVERTISER')
  @Post('validate') validate(@GetUser() user: { id: string; role: string; areaId?: string | null }, @Body() dto: ValidateBirthdayClaimDto) { return this.service.validate(user, dto.claimCode, dto.merchantId); }

  @UseGuards(RolesGuard, StaffPermissionGuard)
  @Roles('ADMIN')
  @RequirePermission('create-edit-coupons')
  @Get('admin') listAdmin(@Query() query: { search?: string; status?: string; merchantId?: string; page?: number; limit?: number }) { return this.service.listAdmin(query); }

  @UseGuards(RolesGuard, StaffPermissionGuard)
  @Roles('ADMIN')
  @RequirePermission('create-edit-coupons')
  @Post('admin') create(@Body() dto: CreateBirthdayGiftDto) { return this.service.create(dto); }

  @UseGuards(RolesGuard, StaffPermissionGuard)
  @Roles('ADMIN')
  @RequirePermission('create-edit-coupons')
  @Patch('admin/:id') update(@Param('id') id: string, @Body() dto: Partial<CreateBirthdayGiftDto>) { return this.service.update(id, dto); }

  @UseGuards(RolesGuard, StaffPermissionGuard)
  @Roles('ADMIN')
  @RequirePermission('delete-content')
  @Delete('admin/:id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
