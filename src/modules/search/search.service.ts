import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: { role?: string; areaId?: string | null } | null, query: SearchQueryDto) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50);
    const area = query.areaSlug
      ? await this.prisma.area.findFirst({ where: { slug: query.areaSlug, isDeleted: false } })
      : null;
    const areaId = user?.role === 'ADMIN' ? area?.id ?? user.areaId : area?.id ?? user?.areaId;
    if (!areaId) throw new ForbiddenException('Area scope is required');

    const text = query.q?.trim();
    const category = query.categorySlug
      ? await this.prisma.category.findFirst({ where: { slug: query.categorySlug, isDeleted: false } })
      : null;

    const where = {
      areaId,
      status: 'ACTIVE' as const,
      isDeleted: false,
      merchant: { isDeleted: false },
      area: { isDeleted: false },
      categoryId: category?.id,
      OR: text
        ? [
            { title: { contains: text, mode: 'insensitive' as const } },
            { description: { contains: text, mode: 'insensitive' as const } },
            { merchant: { name: { contains: text, mode: 'insensitive' as const } } },
            { merchant: { address: { contains: text, mode: 'insensitive' as const } } },
            { category: { name: { contains: text, mode: 'insensitive' as const } } },
            { area: { name: { contains: text, mode: 'insensitive' as const } } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        include: { merchant: true, area: true, category: true },
        orderBy: [{ isWhitelisted: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
