import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { CreateMerchantDto } from './dto/create-merchant.dto.js';
import { AdminMerchantQueryDto } from './dto/admin-merchant-query.dto.js';
import { BulkIdsDto } from '../../common/dto/bulk-ids.dto.js';
import { BulkMerchantStatusDto } from './dto/bulk-merchant-status.dto.js';
import { Body as BodyType } from '@nestjs/common';
import { MerchantsService } from './merchants.service.js';

@UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
@ApiTags('Merchants')
@ApiBearerAuth('access-token')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Roles('ADMIN', 'ADVERTISER')
  @RequirePermission('manage-business-profiles')
  @Post()
  create(@GetUser() user: { id: string; role: string; areaId?: string | null }, @Body() dto: CreateMerchantDto) {
    return this.merchantsService.create(user, dto);
  }

  @Get()
  findForArea(@GetUser() user: { role: string; areaId?: string | null }, @Query('areaId') areaId?: string) {
    return this.merchantsService.findForArea(user, areaId);
  }

  @Roles('ADMIN')
  @RequirePermission('manage-business-profiles')
  @Get('admin')
  findAdmin(@Query() query: AdminMerchantQueryDto) {
    return this.merchantsService.findAdmin(query);
  }

  @Roles('ADMIN')
  @RequirePermission('manage-business-profiles')
  @Post('admin/import')
  importCsv(@BodyType('csv') csv: string) {
    return this.merchantsService.importCsv(csv);
  }

  @Roles('ADMIN')
  @RequirePermission('manage-business-profiles')
  @Patch('admin/bulk-status')
  bulkStatus(@Body() dto: BulkMerchantStatusDto) {
    return this.merchantsService.bulkStatus(dto);
  }

  @Roles('ADMIN')
  @RequirePermission('delete-content')
  @Delete('admin/bulk')
  bulkDelete(@Body() dto: BulkIdsDto) {
    return this.merchantsService.bulkDelete(dto.ids);
  }

  @Roles('ADMIN', 'ADVERTISER')
  @RequirePermission('manage-business-profiles')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateMerchantDto>) {
    return this.merchantsService.update(id, dto);
  }

  @Roles('ADMIN')
  @RequirePermission('delete-content')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.merchantsService.remove(id);
  }
}
