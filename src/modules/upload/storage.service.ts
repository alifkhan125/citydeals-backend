import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';
import 'multer';

export interface StorageFileResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  resourceType?: string;
  width?: number;
  height?: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storage!: Storage;
  private bucketName!: string;
  private bucket!: Bucket;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId =
      this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID') ||
      process.env.GOOGLE_CLOUD_PROJECT_ID ||
      'citydeals-app';
    this.bucketName =
      this.configService.get<string>('GOOGLE_CLOUD_BUCKET_NAME') ||
      process.env.GOOGLE_CLOUD_BUCKET_NAME ||
      'citydeals-images-bucket';

    this.storage = new Storage({
      projectId,
    });
    this.bucket = this.storage.bucket(this.bucketName);

    this.logger.log(
      `Google Cloud Storage initialized: project=${projectId}, bucket=${this.bucketName}`,
    );
  }

  private resolvePath(folder?: string, publicId?: string, originalName?: string): string {
    const base = 'citydeals';
    const folderClean = folder ? folder.replace(/^\/+|\/+$/g, '') : 'general';
    const folderPath = folderClean.startsWith(base) ? folderClean : `${base}/${folderClean}`;

    if (publicId) {
      const cleanId = publicId.replace(/^\/+|\/+$/g, '');
      return cleanId.startsWith(base) ? cleanId : `${folderPath}/${cleanId}`;
    }

    const timestamp = Date.now();
    const cleanOriginal = originalName
      ? originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
      : 'file.jpg';
    return `${folderPath}/${timestamp}_${cleanOriginal}`;
  }

  async uploadFile(
    file: Express.Multer.File,
    options?: { folder?: string; publicId?: string },
  ): Promise<StorageFileResult> {
    if (!file || !file.buffer) {
      throw new InternalServerErrorException('No file buffer provided for Google Cloud Storage upload');
    }

    const destination = this.resolvePath(options?.folder, options?.publicId, file.originalname);
    const blob = this.bucket.file(destination);

    return new Promise<StorageFileResult>((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          contentType: file.mimetype || 'application/octet-stream',
        },
      });

      blobStream.on('error', (err) => {
        this.logger.error(`GCS upload stream error for ${destination}: ${err.message}`, err.stack);
        reject(
          new InternalServerErrorException(
            err.message || 'Failed to upload image to Google Cloud Storage',
          ),
        );
      });

      blobStream.on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${blob.name}`;
        const format = (
          file.originalname?.split('.').pop() ||
          file.mimetype?.split('/')[1] ||
          'jpg'
        ).toLowerCase();

        resolve({
          url: publicUrl,
          secureUrl: publicUrl,
          publicId: blob.name,
          format,
          bytes: file.size || file.buffer.length,
          resourceType: 'image',
        });
      });

      blobStream.end(file.buffer);
    });
  }

  async uploadBase64(
    base64Data: string,
    options?: { folder?: string; publicId?: string },
  ): Promise<StorageFileResult> {
    try {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const mimeType = matches ? matches[1] : 'image/png';
      const rawBase64 = matches ? matches[2] : base64Data;
      const buffer = Buffer.from(rawBase64, 'base64');

      const ext = mimeType.split('/')[1] || 'png';
      const destination = this.resolvePath(
        options?.folder,
        options?.publicId,
        `image.${ext}`,
      );

      const blob = this.bucket.file(destination);

      await blob.save(buffer, {
        contentType: mimeType,
        resumable: false,
      });

      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${blob.name}`;

      return {
        url: publicUrl,
        secureUrl: publicUrl,
        publicId: blob.name,
        format: ext,
        bytes: buffer.length,
        resourceType: 'image',
      };
    } catch (error: any) {
      this.logger.error(`GCS upload base64 error: ${error?.message || error}`, error?.stack);
      throw new InternalServerErrorException(
        error?.message || 'Failed to upload base64 image to Google Cloud Storage',
      );
    }
  }

  async deleteFile(publicId: string): Promise<{ result: string }> {
    try {
      const file = this.bucket.file(publicId);
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
      }
      return { result: 'ok' };
    } catch (error: any) {
      this.logger.error(`GCS delete error for ${publicId}: ${error?.message || error}`, error?.stack);
      throw new InternalServerErrorException(
        error?.message || 'Failed to delete file from Google Cloud Storage',
      );
    }
  }
}
