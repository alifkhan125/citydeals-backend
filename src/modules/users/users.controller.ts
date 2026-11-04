import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { GetUser } from '../../common/decorators/get-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CloudinaryService } from '../upload/cloudinary.service.js';
import { UpdateLanguageDto } from './dto/update-language.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('me')
  getMe(@GetUser() user: { id: string }) {
    return this.usersService.getMe(user.id);
  }

  @Delete('me')
  deleteMe(@GetUser() user: { id: string }) {
    return this.usersService.softDeleteMe(user.id);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload user profile avatar to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'User avatar image file',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Only JPG, PNG and WebP are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @GetUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar image file is required');
    }
    const uploaded = await this.cloudinaryService.uploadFile(file, {
      folder: 'avatars',
      publicId: `user_${user.id}`,
    });
    return this.usersService.updateAvatar(user.id, uploaded.secureUrl);
  }

  @Patch('me')
  updateMe(@GetUser() user: { id: string }, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Patch('me/language')
  updateLanguage(@GetUser() user: { id: string }, @Body() dto: UpdateLanguageDto) {
    return this.usersService.updateLanguage(user.id, dto);
  }

  @Patch('me/notifications')
  updateNotificationSettings(
    @GetUser() user: { id: string },
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.usersService.updateNotificationSettings(user.id, dto);
  }
}
