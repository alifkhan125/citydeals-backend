import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { CouponsService } from './coupons.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { FilterCouponDto } from './dto/filter-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'ADVERTISER')
  @RequirePermission('create-edit-coupons')
  @Post()
  create(@GetUser() user: { role: string; areaId?: string | null }, @Body() dto: CreateCouponDto) {
    return this.couponsService.create(user, dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  find(@GetUser() user: { role?: string; areaId?: string | null } | null, @Query() filter: FilterCouponDto) {
    return this.couponsService.find(user, filter);
  }

  @Get('public/:shareSlug')
  findPublicByShareSlug(@Param('shareSlug') shareSlug: string) {
    return this.couponsService.findPublicByShareSlug(shareSlug);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('saved')
  findSavedCoupons(@GetUser() user: { id: string }) {
    return this.couponsService.findSavedCoupons(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('redeemed')
  findRedeemedCoupons(@GetUser() user: { id: string }) {
    return this.couponsService.findRedeemedCoupons(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post(':id/save')
  saveCoupon(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.couponsService.saveCoupon(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Delete(':id/save')
  unsaveCoupon(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.couponsService.unsaveCoupon(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post(':id/redeem')
  redeemCoupon(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.couponsService.redeemCoupon(user.id, id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post(':id/view')
  trackView(@Param('id') id: string, @GetUser() user?: { id?: string }, @Body('source') source?: string) {
    return this.couponsService.trackView(id, user?.id, source || 'APP');
  }

  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':id')
  findById(@Param('id') id: string, @GetUser() user?: { id?: string }) {
    return this.couponsService.findById(id, user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'ADVERTISER')
  @RequirePermission('create-edit-coupons')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto = {}) {
    return this.couponsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @RequirePermission('delete-content')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'ADVERTISER')
  @RequirePermission('create-edit-coupons')
  @Post(':id/notify-nearby')
  notifyNearby(@Param('id') id: string) {
    return this.couponsService.notifyNearbyUsers(id);
  }
}
