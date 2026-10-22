import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  findAll() {
    return this.prisma.category.findMany({
      where: { isDeleted: false },
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
        area: { isDeleted: false },
        merchant: { isDeleted: false },
      },
      include: { merchant: true, area: true, category: true },
      orderBy: [{ isWhitelisted: 'desc' }, { createdAt: 'desc' }],
    });
  }

  update(id: string, dto: UpdateCategoryDto = {}) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one category field is required');
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
