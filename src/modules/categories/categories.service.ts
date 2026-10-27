import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const rawSlug = (dto.slug || dto.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const baseSlug = rawSlug || 'category';

    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    return this.prisma.category.create({ data: { ...dto, slug } });
  }

  findAll(user?: { role?: string } | null) {
    return this.prisma.category.findMany({
      where: user?.role === 'ADMIN'
        ? { isDeleted: false }
        : { isDeleted: false, status: 'ACTIVE' },
      include: {
        _count: {
          select: { coupons: true, merchants: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findCoupons(categorySlugOrId: string, areaSlug?: string) {
    const category = await this.prisma.category.findFirst({
      where: { isDeleted: false, OR: [{ slug: categorySlugOrId }, { id: categorySlugOrId }] },
    });
    if (!category) throw new NotFoundException('Category not found');

    const area = areaSlug ? await this.prisma.area.findFirst({ where: { slug: areaSlug, isDeleted: false } }) : null;
    if (areaSlug && !area) throw new NotFoundException('Area not found');

    return this.prisma.coupon.findMany({
      where: {
        categoryId: category.id,
        areaId: area?.id,
        status: 'ACTIVE',
        isDeleted: false,
        area: { isDeleted: false },
        merchant: { isDeleted: false },
      },
      include: { merchant: true, area: true, category: true },
      orderBy: [{ isWhitelisted: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async update(id: string, dto: UpdateCategoryDto = {}) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one category field is required');
    }
    if (dto.slug) {
      const existing = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category slug "${dto.slug}" is already in use.`);
      }
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    await this.prisma.category.update({ where: { id }, data: { isDeleted: true } });
    return { id, deleted: true, softDeleted: true };
  }
}
