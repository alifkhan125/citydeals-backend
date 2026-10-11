import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateMerchantDto } from './dto/create-merchant.dto.js';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: { id: string; role: string; areaId?: string | null }, dto: CreateMerchantDto) {
    let areaId = dto.areaId || user.areaId;
    if (!areaId) {
      const defaultArea = await this.prisma.area.findFirst({ orderBy: { createdAt: 'asc' } });
      areaId = defaultArea?.id;
    }
    if (!areaId) throw new BadRequestException('Area is required. Please create an area first.');

    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!area) throw new NotFoundException('Area not found');

    let categoryId = dto.categoryId;
    if (!categoryId || categoryId === '') {
      categoryId = undefined;
    }

    return this.prisma.merchant.create({
      data: {
        name: dto.name,
        description: dto.description,
        titleText: dto.titleText,
        logoUrl: dto.logoUrl,
        categoryId,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        websiteUrl: dto.websiteUrl,
        instagramUrl: dto.instagramUrl,
        facebookUrl: dto.facebookUrl,
        tiktokUrl: dto.tiktokUrl,
        radiusMeters: dto.radiusMeters ?? Number(area.radiusMeters),
        status: dto.status ?? 'ACTIVE',
        latitude: Number(area.latitude),
        longitude: Number(area.longitude),
        areaId,
        ownerId: user.role === 'ADVERTISER' ? user.id : undefined,
      },
      include: { area: true, category: true },
    });
  }

  findForArea(user: { role: string; areaId?: string | null }, areaId?: string) {
    const scopedAreaId = areaId || user.areaId;
    return this.prisma.merchant.findMany({
      where: user.role === 'ADMIN' ? (areaId ? { areaId } : {}) : (scopedAreaId ? { areaId: scopedAreaId } : {}),
      include: { area: true, category: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, dto: Partial<CreateMerchantDto>) {
    const data: any = { ...dto };
    if (data.categoryId === '') {
      data.categoryId = null;
    }
    if (data.areaId) {
      const area = await this.prisma.area.findUnique({ where: { id: data.areaId } });
      if (!area) throw new NotFoundException('Area not found');
      data.latitude = Number(area.latitude);
      data.longitude = Number(area.longitude);
      data.radiusMeters = data.radiusMeters ?? Number(area.radiusMeters);
    } else {
      delete data.latitude;
      delete data.longitude;
    }
    return this.prisma.merchant.update({
      where: { id },
      data,
      include: { area: true, category: true },
    });
  }

  async remove(id: string) {
    await this.prisma.merchant.delete({ where: { id } });
    return { id, deleted: true };
  }
}
