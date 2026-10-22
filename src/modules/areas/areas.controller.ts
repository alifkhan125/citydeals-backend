import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { AreasService } from './areas.service.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';

@ApiTags('Areas')
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Get()
  findAll() {
    return this.areasService.findAll();
  }

  @Get('resolve')
  resolve(
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    if (!latitude || !longitude) return null;
    return this.areasService.resolveArea(Number(latitude), Number(longitude));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Post('regenerate-all-qr')
  regenerateAllQr() {
    return this.areasService.regenerateAllQr();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Post(':id/regenerate-qr')
  regenerateQr(@Param('id') id: string) {
    return this.areasService.regenerateQr(id);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.areasService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @RequirePermission('delete-content')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.areasService.remove(id);
  }
}
