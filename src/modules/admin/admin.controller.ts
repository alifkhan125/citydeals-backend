import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminService } from './admin.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpsertRolePermissionsDto } from './dto/upsert-role-permissions.dto.js';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly dashboard: AdminDashboardService,
  ) {}

  // ─── Dashboard (no permission restriction — all staff can view) ───────────
  @Get('dashboard/stats') stats() { return this.dashboard.stats(); }
  @Get('dashboard/redemptions/daily') daily() { return this.dashboard.dailyRedemptions(); }
  @Get('dashboard/redemptions/by-area') byArea() { return this.dashboard.redemptionsByArea(); }
  @Get('dashboard/trending-coupons') trending() { return this.dashboard.trendingCoupons(); }

  @Get('search')
  @Roles('ADMIN', 'ADVERTISER')
  search(
    @GetUser() user: { id: string; role: string; areaId?: string | null },
    @Query('q') q?: string,
  ) {
    return this.admin.search(user, q);
  }

  @Get('geocode/suggestions')
  @Roles('ADMIN', 'ADVERTISER')
  geocodeSuggestions(@Query('q') q: string) {
    return this.admin.geocodeSuggestions(q);
  }

  @Get('geocode')
  @Roles('ADMIN', 'ADVERTISER')
  geocode(@Query('q') q: string) {
    return this.admin.geocode(q);
  }

  // ─── Analytics (view-only — no specific permission needed) ───────────────
  @Get('redemptions')
  @Roles('ADMIN', 'ADVERTISER')
  redemptions(
    @GetUser() user: { id: string; role: string; areaId?: string | null },
    @Query('areaId') areaId?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.redemptions(user, areaId, search);
  }

  @Get('saved-activity')
  @Roles('ADMIN', 'ADVERTISER')
  savedActivity(
    @GetUser() user: { id: string; role: string; areaId?: string | null },
    @Query('areaId') areaId?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.savedActivity(user, areaId, search);
  }

  @Get('share-analytics')
  @Roles('ADMIN', 'ADVERTISER')
  shareAnalytics(
    @GetUser() user: { id: string; role: string; areaId?: string | null },
    @Query('areaId') areaId?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.shareAnalytics(user, areaId, search);
  }

  // ─── Users ────────────────────────────────────────────────────────────────
  @Get('users') users() { return this.admin.users(); }
  @Get('users/:id') user(@Param('id') id: string) { return this.admin.user(id); }

  @Patch('users/:id/status')
  @RequirePermission('manage-registered-users')
  updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.admin.updateUserStatus(id, dto);
  }

  // ─── Staff accounts ───────────────────────────────────────────────────────
  @Get('staff') staff() { return this.admin.staff(); }

  @Post('staff')
  @RequirePermission('manage-staff-accounts')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.admin.createStaff(dto);
  }

  @Patch('staff/:id/role')
  @RequirePermission('manage-staff-accounts')
  updateStaffRole(@Param('id') id: string, @Body() dto: UpdateStaffRoleDto) {
    return this.admin.updateStaffRole(id, dto);
  }

  @Patch('staff/:id/status')
  @RequirePermission('manage-staff-accounts')
  updateStaffStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.admin.updateStaffStatus(id, status);
  }

  @Delete('staff/:id')
  @RequirePermission('manage-staff-accounts')
  deleteStaff(@Param('id') id: string) {
    return this.admin.deleteStaff(id);
  }

  // ─── Roles ────────────────────────────────────────────────────────────────
  @Get('roles') roles() { return this.admin.roles(); }

  @Patch('roles/permissions')
  @RequirePermission('manage-staff-accounts')
  permissions(@Body() dto: UpsertRolePermissionsDto) {
    return this.admin.upsertRolePermissions(dto);
  }
}
