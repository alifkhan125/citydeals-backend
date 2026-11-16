import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import { StorageService } from '../upload/storage.service.js';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  async generateAreaQrCode(slug: string): Promise<string> {
    const baseUrl = this.configService.get<string>('app.publicBaseUrl');
    const directoryUrl = `${baseUrl}/directory/${slug}`;
    const dataUrl = await QRCode.toDataURL(directoryUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 1200,
    });
    return this.uploadQrAsset(slug, dataUrl);
  }

  private async uploadQrAsset(slug: string, dataUrl: string): Promise<string> {
    try {
      const res = await this.storageService.uploadBase64(dataUrl, {
        folder: 'qr/areas',
        publicId: `qr_${slug}`,
      });
      return res.secureUrl;
    } catch (error) {
      this.logger.warn(`Failed to upload QR to Google Cloud Storage, falling back to data URL: ${error}`);
      return dataUrl;
    }
  }
}
