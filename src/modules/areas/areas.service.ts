import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { haversineDistanceMeters } from '../../common/utils/geo.util.js';
import { PrismaService } from '../../database/prisma.service.js';
import { QrService } from '../qr/qr.service.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';

@Injectable()
export class AreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: QrService,
  ) {}

  async create(dto: CreateAreaDto) {
    const rawSlug = (dto.slug || dto.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const baseSlug = rawSlug || 'area';

    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await this.prisma.area.findUnique({ where: { slug: uniqueSlug } })) {
      counter++;
      uniqueSlug = `${baseSlug}-${counter}`;
    }

    const area = await this.prisma.area.create({
      data: {
        name: dto.name,
        slug: uniqueSlug,
        city: dto.city,
        state: dto.state,
        latitude: dto.latitude ?? 40.416775,
        longitude: dto.longitude ?? -3.703790,
        radiusMeters: dto.radiusMeters ?? 15000,
      },
    });
    const qrCodeUrl = await this.qrService.generateAreaQrCode(area.slug);
    return this.prisma.area.update({ where: { id: area.id }, data: { qrCodeUrl } });
  }

  findAll() {
    return this.prisma.area.findMany({
      where: { isDeleted: false },
      include: {
        _count: {
          select: {
            merchants: true,
            coupons: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const area = await this.prisma.area.findFirst({ where: { slug, isDeleted: false } });
    if (!area) throw new NotFoundException('Area not found');
    return area;
  }

  async getDirectoryData(slug: string) {
    const area = await this.prisma.area.findFirst({
      where: { slug, isDeleted: false },
      include: {
        merchants: {
          where: { isDeleted: false },
          include: {
            coupons: {
              where: { status: 'ACTIVE', merchant: { isDeleted: false } },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!area || area.isDeleted) throw new NotFoundException('Area not found');

    return area;
  }

  async update(id: string, dto: UpdateAreaDto) {
    const current = await this.prisma.area.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Area not found');

    const updateData: any = { ...dto };
    if (updateData.slug && updateData.slug !== current.slug) {
      updateData.slug = updateData.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const existing = await this.prisma.area.findUnique({ where: { slug: updateData.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Directory slug "${updateData.slug}" is already in use by another area.`);
      }
    }

    const qrCodeUrl =
      updateData.slug && updateData.slug !== current.slug
        ? await this.qrService.generateAreaQrCode(updateData.slug)
        : undefined;

    const updatedArea = await this.prisma.area.update({
      where: { id },
      data: {
        ...updateData,
        ...(qrCodeUrl ? { qrCodeUrl } : {}),
      },
    });

    if (
      updateData.latitude !== undefined ||
      updateData.longitude !== undefined ||
      updateData.radiusMeters !== undefined
    ) {
      await this.prisma.merchant.updateMany({
        where: { areaId: id },
        data: {
          latitude: Number(updatedArea.latitude),
          longitude: Number(updatedArea.longitude),
          radiusMeters: Number(updatedArea.radiusMeters),
        },
      });
    }

    return updatedArea;
  }

  async remove(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isDeleted: true,
        _count: { select: { merchants: true, coupons: true } },
      },
    });
    if (!area) throw new NotFoundException('Area not found');

    if (area.isDeleted) return { id, deleted: true, softDeleted: true };

    await this.prisma.area.update({ where: { id }, data: { isDeleted: true } });
    return { id, deleted: true, softDeleted: true };
  }

  async resolveArea(latitude: number, longitude: number) {
    const areas = await this.prisma.area.findMany({ where: { isDeleted: false } });
    if (areas.length === 0) return null;

    const sorted = areas
      .map((area) => ({
        ...area,
        distanceMeters: haversineDistanceMeters(
          { latitude, longitude },
          { latitude: Number(area.latitude), longitude: Number(area.longitude) },
        ),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return sorted.find((area) => area.distanceMeters <= area.radiusMeters) ?? null;
  }

  async regenerateQr(id: string) {
    const area = await this.prisma.area.findFirst({ where: { id, isDeleted: false } });
    if (!area) throw new NotFoundException('Area not found');
    const qrCodeUrl = await this.qrService.generateAreaQrCode(area.slug);
    return this.prisma.area.update({ where: { id }, data: { qrCodeUrl } });
  }

  async regenerateAllQr() {
    const areas = await this.prisma.area.findMany({ where: { isDeleted: false } });
    const results = await Promise.all(
      areas.map(async (area) => {
        try {
          const qrCodeUrl = await this.qrService.generateAreaQrCode(area.slug);
          return await this.prisma.area.update({ where: { id: area.id }, data: { qrCodeUrl } });
        } catch (e) {
          return area;
        }
      })
    );
    return { count: results.length };
  }
}
