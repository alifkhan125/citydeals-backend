import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateMerchantDto } from './dto/create-merchant.dto.js';
import { AdminMerchantQueryDto } from './dto/admin-merchant-query.dto.js';
import { csvRecords } from '../../common/utils/csv.util.js';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: { id: string; role: string; areaId?: string | null }, dto: CreateMerchantDto) {
    let areaId = dto.areaId || user.areaId;
    if (!areaId) {
      const defaultArea = await this.prisma.area.findFirst({ where: { isDeleted: false }, orderBy: { createdAt: 'asc' } });
      areaId = defaultArea?.id;
    }
    if (!areaId) throw new BadRequestException('Area is required. Please create an area first.');

    const area = await this.prisma.area.findFirst({ where: { id: areaId, isDeleted: false } });
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
      where: {
        ...(user.role === 'ADMIN' ? (areaId ? { areaId } : {}) : (scopedAreaId ? { areaId: scopedAreaId } : {})),
        area: { isDeleted: false },
        isDeleted: false,
      },
      include: { area: true, category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAdmin(query: AdminMerchantQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.search?.trim();
    const where: any = {
      isDeleted: false,
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (query.idsOnly === 'true') {
      const ids = await this.prisma.merchant.findMany({ where, select: { id: true } });
      return { ids: ids.map((item) => item.id) };
    }

    const [items, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        include: { area: true, category: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.merchant.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async bulkStatus(dto: { ids: string[]; status: 'ACTIVE' | 'INACTIVE' }) {
    const result = await this.prisma.merchant.updateMany({
      where: { id: { in: dto.ids }, isDeleted: false },
      data: { status: dto.status },
    });
    return { updated: result.count };
  }

  async bulkDelete(ids: string[]) {
    const result = await this.prisma.merchant.updateMany({
      where: { id: { in: ids }, isDeleted: false },
      data: { isDeleted: true, status: 'INACTIVE' },
    });
    return { deleted: result.count, softDeleted: true };
  }

  async importCsv(csv: string) {
    if (!csv?.trim()) throw new BadRequestException('CSV content is required');
    const records = csvRecords(csv);
    const imported: string[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, record] of records.entries()) {
      const row = index + 2;
      try {
        if (!record.name || !record.address || !record.area) throw new Error('name, address and area are required');
        const area = await this.prisma.area.findFirst({ where: { slug: record.area, isDeleted: false } });
        if (!area) throw new Error(`Area not found: ${record.area}`);
        const category = record.category ? await this.prisma.category.findFirst({ where: { slug: record.category, isDeleted: false } }) : null;
        if (record.category && !category) throw new Error(`Category not found: ${record.category}`);
        const status = record.status || 'ACTIVE';
        if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new Error(`Invalid status: ${status}`);
        const existing = await this.prisma.merchant.findFirst({ where: { name: record.name, areaId: area.id, isDeleted: false } });
        if (existing) throw new Error('Duplicate business in this area');

        const merchant = await this.prisma.merchant.create({
          data: {
            name: record.name,
            description: record.description || undefined,
            titleText: record.titleText || undefined,
            logoUrl: record.logoUrl || undefined,
            categoryId: category?.id,
            areaId: area.id,
            address: record.address,
            phone: record.phone || undefined,
            email: record.email || undefined,
            websiteUrl: record.websiteUrl || undefined,
            instagramUrl: record.instagramUrl || undefined,
            facebookUrl: record.facebookUrl || undefined,
            tiktokUrl: record.tiktokUrl || undefined,
            radiusMeters: record.radiusMeters ? Number(record.radiusMeters) : Number(area.radiusMeters),
            latitude: Number(area.latitude),
            longitude: Number(area.longitude),
            status: status as any,
          },
        });
        imported.push(merchant.id);
      } catch (error) {
        errors.push({ row, message: error instanceof Error ? error.message : 'Invalid row' });
      }
    }

    return { imported: imported.length, failed: errors.length, ids: imported, errors };
  }

  async update(id: string, dto: Partial<CreateMerchantDto>) {
    const data: any = { ...dto };
    if (data.categoryId === '') {
      data.categoryId = null;
    }
    if (data.areaId) {
      const area = await this.prisma.area.findFirst({ where: { id: data.areaId, isDeleted: false } });
      if (!area) throw new NotFoundException('Area not found');
      data.latitude = Number(area.latitude);
      data.longitude = Number(area.longitude);
      data.radiusMeters = data.radiusMeters ?? Number(area.radiusMeters);
    } else {
      delete data.latitude;
      delete data.longitude;
    }
    const merchant = await this.prisma.merchant.findFirst({ where: { id, isDeleted: false } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.prisma.merchant.update({
      where: { id },
      data,
      include: { area: true, category: true },
    });
  }

  async remove(id: string) {
    const merchant = await this.prisma.merchant.findFirst({ where: { id, isDeleted: false } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    await this.prisma.merchant.update({ where: { id }, data: { isDeleted: true } });
    return { id, deleted: true, softDeleted: true };
  }
}
