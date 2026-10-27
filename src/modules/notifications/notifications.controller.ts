import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Body, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { SendNotificationDto } from './dto/send-notification.dto.js';
import { UpdateBirthdaySettingsDto } from './dto/birthday-settings.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@GetUser() user: { id: string }, @Query() query: ListNotificationsDto) {
    return this.notificationsService.findMine(user.id, query);
  }

  @Patch(':id/read')
  markAsRead(@GetUser() user: { id: string }, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADVERTISER')
  @Get('admin/history')
  findAllAdmin(@Query('search') search?: string) {
    return this.notificationsService.findAllAdmin({ search });
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADVERTISER')
  @Post('send')
  send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.send(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADVERTISER')
  @Get('birthday-settings')
  getBirthdaySettings() {
    return this.notificationsService.getBirthdaySettings();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADVERTISER')
  @Post('birthday-settings')
  updateBirthdaySettings(@Body() dto: UpdateBirthdaySettingsDto) {
    return this.notificationsService.updateBirthdaySettings(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADVERTISER')
  @Post('trigger-birthday-checks')
  triggerBirthdayChecks() {
    return this.notificationsService.checkAndSendBirthdayNotifications();
  }
}
