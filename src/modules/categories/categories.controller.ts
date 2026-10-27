import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @RequirePermission('manage-coupon-categories')
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@GetUser() user?: { role?: string } | null) {
    return this.categoriesService.findAll(user);
  }

  @Get(':slugOrId/coupons')
  findCoupons(@Param('slugOrId') slugOrId: string, @Query('areaSlug') areaSlug?: string) {
    return this.categoriesService.findCoupons(slugOrId, areaSlug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @RequirePermission('manage-coupon-categories')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto = {}) {
    return this.categoriesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN')
  @RequirePermission('delete-content')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
