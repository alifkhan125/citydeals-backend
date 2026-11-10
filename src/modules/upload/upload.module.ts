import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StorageService } from './storage.service.js';
import { UploadController } from './upload.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [UploadController],
  providers: [StorageService],
  exports: [StorageService],
})
export class UploadModule {}
