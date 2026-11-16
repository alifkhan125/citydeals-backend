/**
 * CLOUDINARY SERVICE (HIDDEN / DISABLED)
 * Replaced by Google Cloud Storage (StorageService) in storage.service.ts
 */

/*
import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'node:stream';
import 'multer';

export interface CloudinaryFileResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  resourceType: string;
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const cloudName =
      this.configService.get<string>('cloudinary.cloudName') ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      'jynnshnm';
    const apiKey =
      this.configService.get<string>('cloudinary.apiKey') ||
      process.env.CLOUDINARY_API_KEY ||
      '332732283241628';
    const apiSecret =
      this.configService.get<string>('cloudinary.apiSecret') ||
      process.env.CLOUDINARY_API_SECRET ||
      'Lb1TIml_ZRbJZh0XZfu77VkZBec';

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.logger.log(`Cloudinary initialized with cloud_name: ${cloudName}`);
  }

  private resolveFolder(folder?: string): string {
    const base = 'citydeals';
    if (!folder) return base;
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    return cleanFolder.startsWith(base) ? cleanFolder : `${base}/${cleanFolder}`;
  }

  async uploadFile(
    file: Express.Multer.File,
    options?: { folder?: string; publicId?: string },
  ): Promise<CloudinaryFileResult> {
    if (!file || !file.buffer) {
      throw new InternalServerErrorException('No file buffer provided for Cloudinary upload');
    }

    const folder = this.resolveFolder(options?.folder);

    return new Promise<CloudinaryFileResult>((resolve, reject) => {
      const uploadOptions: Record<string, any> = {
        folder,
        resource_type: 'auto',
      };

      if (options?.publicId) {
        uploadOptions.public_id = options.publicId;
      }

      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload stream error: ${error?.message || 'Unknown error'}`);
            return reject(
              new InternalServerErrorException(
                error?.message || 'Failed to upload image to Cloudinary',
              ),
            );
          }

          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            resourceType: result.resource_type,
          });
        },
      );

      Readable.from(file.buffer).pipe(stream);
    });
  }

  async uploadBase64(
    base64Data: string,
    options?: { folder?: string; publicId?: string },
  ): Promise<CloudinaryFileResult> {
    const folder = this.resolveFolder(options?.folder);

    try {
      const uploadOptions: Record<string, any> = {
        folder,
        resource_type: 'auto',
      };

      if (options?.publicId) {
        uploadOptions.public_id = options.publicId;
      }

      const result = await cloudinary.uploader.upload(base64Data, uploadOptions);

      return {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resourceType: result.resource_type,
      };
    } catch (error: any) {
      this.logger.error(`Cloudinary upload base64 error: ${error?.message || error}`);
      throw new InternalServerErrorException(
        error?.message || 'Failed to upload base64 image to Cloudinary',
      );
    }
  }

  async deleteFile(publicId: string): Promise<{ result: string }> {
    try {
      const res = await cloudinary.uploader.destroy(publicId);
      return { result: res.result || 'ok' };
    } catch (error: any) {
      this.logger.error(`Cloudinary delete error for publicId ${publicId}: ${error?.message || error}`);
      throw new InternalServerErrorException(
        error?.message || 'Failed to delete file from Cloudinary',
      );
    }
  }
}
*/
