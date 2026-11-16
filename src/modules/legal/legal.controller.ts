import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { StaffPermissionGuard } from '../../common/guards/staff-permission.guard.js';
import { LegalService } from './legal.service.js';
import { UpsertLegalDto } from './dto/upsert-legal.dto.js';

@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('terms')
  @ApiOperation({ summary: 'Get active Terms of Use document for mobile app' })
  getTerms() {
    return this.legalService.getTerms();
  }

  @Get('pages')
  @ApiOperation({ summary: 'Get all legal documents' })
  getAllPages() {
    return this.legalService.getAllPages();
  }

  @Get('pages/:type')
  @ApiOperation({ summary: 'Get specific legal document by type or slug' })
  getPageLegacy(@Param('type') type: string) {
    return this.legalService.getPage(type);
  }

  @Put('pages/:type')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('edit-app-pages')
  @ApiOperation({ summary: 'Update or create legal document content (Admin)' })
  upsertPageLegacy(@Param('type') type: string, @Body() dto: UpsertLegalDto) {
    return this.legalService.upsertPage(type, dto);
  }

  @Get(':type')
  @ApiOperation({ summary: 'Get legal content by type (e.g. privacy or terms)' })
  getPage(@Param('type') type: string) {
    return this.legalService.getPage(type);
  }

  @Post(':type')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard, StaffPermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('edit-app-pages')
  @ApiOperation({ summary: 'Create or update legal content by type (Admin)' })
  upsertPage(@Param('type') type: string, @Body() dto: UpsertLegalDto) {
    return this.legalService.upsertPage(type, dto);
  }
}
