import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { UpsertLegalDto } from './dto/upsert-legal.dto.js';

const DEFAULT_DOCUMENTS = [
  {
    type: 'TERMS_OF_USE',
    title: 'Terms of Use',
    version: '1.0',
    content: `1. Acceptance of Terms
By downloading, accessing, or using the CityDeals mobile application and related services, you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree to these terms, you must not use or access CityDeals.

2. User Accounts & Security
To access certain features of the platform, such as saving and redeeming coupons, you must create an account. You are responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.

3. Coupon Offers & Redemption Rules
Coupons and discounts featured on CityDeals are offered by independent third-party merchants. Each coupon is subject to the specific terms, discount limits, expiration dates, and frequency limits set by the merchant. CityDeals does not guarantee merchant inventory or store availability.

4. Merchant Responsibility
Participating merchants are solely responsible for the goods and services they provide, including honoring valid coupons presented through the CityDeals app. CityDeals is an intermediary promotional platform and does not sell or manufacture merchant products directly.

5. User Conduct & Abuse Prevention
Users agree not to attempt to fraudulently duplicate coupon redemptions, reverse-engineer the application, or use automated systems to scrape deals. Violation of these rules may result in account termination.

6. Limitation of Liability
To the maximum extent permitted by applicable law, CityDeals and its affiliates shall not be liable for any indirect, incidental, or consequential damages resulting from merchant service quality or coupon redemption disputes.

7. Modifications & Contact
CityDeals reserves the right to update these Terms at any time. Continued use of the platform constitutes acceptance of revised terms. For questions or concerns, please contact our support team at support@citydeals.com.`,
  },
  {
    type: 'PRIVACY_POLICY',
    title: 'Privacy Policy',
    version: '1.0',
    content: `1. Information We Collect
We collect information you provide directly to us, such as your name, email address, phone number, and location preferences when you register an account or search for local coupons.

2. Location Services
CityDeals uses your device's location to discover nearby discounts and participating merchant stores within your designated area. You can enable or disable location permissions at any time in your device settings.

3. How We Use Information
We use the information we collect to provide, personalize, and improve CityDeals services, send notification alerts for saved coupons, and maintain account security.

4. Data Protection
We implement industry-standard security measures designed to protect your personal information against unauthorized access, loss, or disclosure.`,
  },
  {
    type: 'COUPON_RULES',
    title: 'Coupon Rules',
    version: '1.0',
    content: `1. One Coupon Per Transaction
Unless explicitly stated otherwise by the merchant, only one coupon may be redeemed per transaction.

2. Expiration Dates
All coupons are subject to strict expiration dates set by the merchant. Expired coupons cannot be redeemed.

3. In-Store Verification
To redeem a coupon, present the active redemption QR code or code screen to the merchant staff at checkout before payment. Coupons cannot be redeemed after a transaction is completed.`,
  },
];

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeType(type: string): string {
    const clean = type.trim().toLowerCase().replace(/-/g, '_');
    if (clean === 'terms' || clean === 'terms_of_use') return 'TERMS_OF_USE';
    if (clean === 'privacy' || clean === 'privacy_policy') return 'PRIVACY_POLICY';
    if (clean === 'coupon_rules' || clean === 'coupon_rule') return 'COUPON_RULES';
    return type.toUpperCase().replace(/-/g, '_');
  }

  async getTerms() {
    return this.getPage('TERMS_OF_USE');
  }

  async getAllPages() {
    for (const defaultDoc of DEFAULT_DOCUMENTS) {
      const exists = await this.prisma.legalDocument.findUnique({
        where: { type: defaultDoc.type },
      });
      if (!exists) {
        await this.prisma.legalDocument.create({ data: defaultDoc });
      }
    }

    return this.prisma.legalDocument.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPage(typeInput: string) {
    const rawType = typeInput.trim().toLowerCase();
    const type = this.normalizeType(typeInput);

    // First check LegalContent model
    const contentRecord = await this.prisma.legalContent.findFirst({
      where: {
        OR: [
          { type: rawType },
          { type },
          { type: rawType.replace(/_/g, '-') },
        ],
      },
    });

    if (contentRecord) {
      return {
        id: contentRecord.id,
        type: contentRecord.type,
        title: contentRecord.title,
        content: contentRecord.content,
        version: '1.0',
        updatedAt: contentRecord.updatedAt,
      };
    }

    let doc = await this.prisma.legalDocument.findUnique({
      where: { type },
    });

    if (!doc) {
      const defaultDoc = DEFAULT_DOCUMENTS.find(
        (d) => d.type === type || this.normalizeType(d.type) === type,
      );
      if (defaultDoc) {
        doc = await this.prisma.legalDocument.create({
          data: defaultDoc,
        });
      }
    }

    if (doc) {
      return doc;
    }

    return {
      id: 'default',
      type,
      title: type.replace(/_/g, ' '),
      version: '1.0',
      content: 'Content will be managed from the admin dashboard.',
      updatedAt: new Date(),
    };
  }

  async upsertPage(typeInput: string, dto: UpsertLegalDto) {
    const rawType = typeInput.trim().toLowerCase();
    const type = this.normalizeType(typeInput);

    // Upsert into LegalContent as specified
    const contentRecord = await this.prisma.legalContent.upsert({
      where: { type: rawType },
      update: {
        title: dto.title,
        content: dto.content,
      },
      create: {
        type: rawType,
        title: dto.title,
        content: dto.content,
      },
    });

    // Also sync to LegalDocument for backward compatibility
    await this.prisma.legalDocument.upsert({
      where: { type },
      update: {
        title: dto.title,
        content: dto.content,
        version: dto.version || '1.0',
      },
      create: {
        type,
        title: dto.title,
        content: dto.content,
        version: dto.version || '1.0',
      },
    });

    return contentRecord;
  }
}
