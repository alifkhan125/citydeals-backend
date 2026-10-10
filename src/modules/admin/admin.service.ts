import { BadRequestException, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpsertRolePermissionsDto } from './dto/upsert-role-permissions.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  users() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        status: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        area: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
        _count: { select: { savedCoupons: true, couponRedemptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private mapGeocodeResult(item: {
    lat?: string;
    lon?: string;
    display_name?: string;
    name?: string;
    namedetails?: Record<string, string | undefined>;
    address?: Record<string, string | undefined>;
  }, fallback: string) {
    const address = item.address ?? {};
    const englishName = item.namedetails?.['name:en'] || item.namedetails?.name;
    return {
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      label: item.display_name || fallback,
      name: englishName || item.name || address.suburb || address.neighbourhood || address.city || address.town || address.village || fallback,
      city: address.city || address.town || address.village || address.county || '',
      state: address.state || address.region || '',
      country: address.country || '',
      provider: 'OpenStreetMap Nominatim',
    };
  }

  async geocode(query: string) {
    const q = query?.trim();
    if (!q) {
      throw new BadRequestException('Search address is required');
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('namedetails', '1');
    url.searchParams.set('accept-language', 'en');

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'CityDealsDashboard/1.0 (admin geocoding)',
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Could not search this address right now');
    }

    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      name?: string;
      namedetails?: Record<string, string | undefined>;
      address?: Record<string, string | undefined>;
    }>;
    const first = results[0];

    if (!first?.lat || !first?.lon) {
      throw new NotFoundException('No coordinates found for this address');
    }

    return this.mapGeocodeResult(first, q);
  }

  async geocodeSuggestions(query: string) {
    const q = query?.trim();
    if (!q) {
      throw new BadRequestException('Search address is required');
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('namedetails', '1');
    url.searchParams.set('accept-language', 'en');

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'CityDealsDashboard/1.0 (admin geocoding)',
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Could not search this address right now');
    }

    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      name?: string;
      namedetails?: Record<string, string | undefined>;
      address?: Record<string, string | undefined>;
    }>;

    return results
      .filter((item) => item.lat && item.lon)
      .map((item) => this.mapGeocodeResult(item, q));
  }

  user(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { area: true, savedCoupons: true, couponRedemptions: true },
    });
  }

  updateUserStatus(id: string, dto: UpdateUserStatusDto) {
    return this.prisma.user.update({ where: { id }, data: { status: dto.status } });
  }

  async staff() {
    let list = await this.prisma.staffAccount.findMany({ orderBy: { createdAt: 'desc' } });
    if (list.length === 0) {
      const defaults = [
        { fullName: 'Shuvo Ahmed', email: 'shuvo@citydeals.test', roleKey: 'Administrator' },
        { fullName: 'Anika Rahman', email: 'anika@citydeals.test', roleKey: 'Manager' },
        { fullName: 'Ravi Kumar', email: 'ravi@citydeals.test', roleKey: 'Editor' },
      ];
      for (const d of defaults) {
        await this.prisma.staffAccount.create({
          data: {
            fullName: d.fullName,
            email: d.email,
            roleKey: d.roleKey,
            status: 'ACTIVE',
          },
        }).catch(() => null);
      }
      list = await this.prisma.staffAccount.findMany({ orderBy: { createdAt: 'desc' } });
    }
    return list;
  }

  async createStaff(dto: CreateStaffDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.staffAccount.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException(`A staff account with email ${email} already exists`);
    }

    const defaultPassword = '12345678';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const staffAccount = await this.prisma.$transaction(async (tx) => {
      // Upsert User to ensure they can log in
      await tx.user.upsert({
        where: { email },
        update: {
          role: 'ADMIN',
          passwordHash,
          fullName: dto.fullName.trim(),
        },
        create: {
          email,
          fullName: dto.fullName.trim(),
          passwordHash,
          role: 'ADMIN',
        },
      });

      return tx.staffAccount.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          roleKey: dto.roleKey,
          status: (dto.status as any) || 'ACTIVE',
        },
      });
    });

    // Send welcome email with login details
    await this.mailService.sendStaffWelcomeEmail(email, dto.fullName.trim(), defaultPassword);

    return staffAccount;
  }

  async updateStaffRole(id: string, dto: UpdateStaffRoleDto) {
    const staff = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (!staff) {
      throw new NotFoundException('Staff account not found');
    }
    return this.prisma.staffAccount.update({
      where: { id },
      data: { roleKey: dto.roleKey },
    });
  }

  async updateStaffStatus(id: string, status: string) {
    const staff = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (!staff) {
      throw new NotFoundException('Staff account not found');
    }
    return this.prisma.staffAccount.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async deleteStaff(id: string) {
    const staff = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (!staff) {
      throw new NotFoundException('Staff account not found');
    }
    return this.prisma.staffAccount.delete({ where: { id } });
  }

  async roles() {
    let roles = await this.prisma.staffRole.findMany({ orderBy: { name: 'asc' } });
    if (roles.length === 0) {
      const defaults = [
        { name: 'Super Administrator', key: 'super-administrator' },
        { name: 'Administrator', key: 'administrator' },
        { name: 'Manager', key: 'manager' },
        { name: 'Editor', key: 'editor' },
        { name: 'Viewer', key: 'viewer' },
      ];
      for (const d of defaults) {
        await this.prisma.staffRole.upsert({
          where: { key: d.key },
          update: {},
          create: {
            name: d.name,
            key: d.key,
            permissions: {},
          },
        }).catch(() => null);
      }
      roles = await this.prisma.staffRole.findMany({ orderBy: { name: 'asc' } });
    }
    return roles;
  }

  upsertRolePermissions(dto: UpsertRolePermissionsDto) {
    return this.prisma.staffRole.upsert({
      where: { key: dto.roleKey },
      update: { permissions: dto.permissions },
      create: {
        key: dto.roleKey,
        name: dto.roleKey.replaceAll('-', ' '),
        permissions: dto.permissions,
      },
    });
  }

  async search(user: { id: string; role: string; areaId?: string | null }, q?: string) {
    const term = q?.trim();
    if (!term) return { query: '', results: [], total: 0 };

    const scopedAreaWhere = user.role === 'ADVERTISER' && user.areaId ? { areaId: user.areaId } : {};
    const contains = { contains: term, mode: 'insensitive' as const };

    const [users, merchants, coupons, categories, staff] = await Promise.all([
      this.prisma.user.findMany({
        where: { OR: [{ fullName: contains }, { email: contains }, { phoneNumber: contains }] },
        select: { id: true, fullName: true, email: true, phoneNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.merchant.findMany({
        where: {
          ...scopedAreaWhere,
          OR: [
            { name: contains },
            { address: contains },
            { phone: contains },
            { email: contains },
            { category: { name: contains } },
            { area: { name: contains } },
          ],
        },
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          area: { select: { name: true, city: true } },
          category: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.coupon.findMany({
        where: {
          ...scopedAreaWhere,
          OR: [
            { title: contains },
            { description: contains },
            { couponCode: contains },
            { merchant: { name: contains } },
            { area: { name: contains } },
            { category: { name: contains } },
          ],
        },
        select: {
          id: true,
          title: true,
          couponCode: true,
          status: true,
          merchant: { select: { name: true } },
          area: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.category.findMany({
        where: { OR: [{ name: contains }, { slug: contains }, { description: contains }] },
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      }),
      user.role === 'ADMIN'
        ? this.prisma.staffAccount.findMany({
            where: { OR: [{ fullName: contains }, { email: contains }, { roleKey: contains }] },
            select: { id: true, fullName: true, email: true, roleKey: true, status: true },
            orderBy: { updatedAt: 'desc' },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    const results = [
      ...users.map((item) => ({
        id: item.id,
        type: 'User',
        name: item.fullName || item.email,
        detail: item.email || item.phoneNumber || 'App user',
        status: item.status,
        href: '/users',
      })),
      ...merchants.map((item) => ({
        id: item.id,
        type: 'Business',
        name: item.name,
        detail: [item.category?.name, item.area?.name, item.address].filter(Boolean).join(' • '),
        status: item.status,
        href: '/businesses',
      })),
      ...coupons.map((item) => ({
        id: item.id,
        type: 'Coupon',
        name: item.title,
        detail: [item.couponCode, item.merchant?.name, item.area?.name].filter(Boolean).join(' • '),
        status: item.status,
        href: '/coupons',
      })),
      ...categories.map((item) => ({
        id: item.id,
        type: 'Category',
        name: item.name,
        detail: item.slug,
        status: item.status,
        href: '/categories',
      })),
      ...staff.map((item) => ({
        id: item.id,
        type: 'Staff',
        name: item.fullName,
        detail: `${item.email} • ${item.roleKey}`,
        status: item.status,
        href: '/staff',
      })),
    ];

    return { query: term, results, total: results.length };
  }

  async redemptions(
    user: { id: string; role: string; areaId?: string | null },
    areaId?: string,
    search?: string,
  ) {
    const scopedAreaId = user.role === 'ADVERTISER' ? user.areaId : areaId;

    const where: any = {};
    if (scopedAreaId) {
      where.coupon = { areaId: scopedAreaId };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { phoneNumber: { contains: term, mode: 'insensitive' } } },
        { coupon: { title: { contains: term, mode: 'insensitive' } } },
        { coupon: { couponCode: { contains: term, mode: 'insensitive' } } },
        { coupon: { merchant: { name: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [items, total, todayCount, thisWeekCount, thisMonthCount] = await Promise.all([
      this.prisma.couponRedemption.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
          coupon: {
            select: {
              id: true,
              title: true,
              couponCode: true,
              imageUrl: true,
              area: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                },
              },
              merchant: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.couponRedemption.count({ where }),
      this.prisma.couponRedemption.count({
        where: {
          ...(scopedAreaId ? { coupon: { areaId: scopedAreaId } } : {}),
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.couponRedemption.count({
        where: {
          ...(scopedAreaId ? { coupon: { areaId: scopedAreaId } } : {}),
          createdAt: { gte: weekStart },
        },
      }),
      this.prisma.couponRedemption.count({
        where: {
          ...(scopedAreaId ? { coupon: { areaId: scopedAreaId } } : {}),
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      items,
      total,
      todayCount,
      thisWeekCount,
      thisMonthCount,
    };
  }

  async savedActivity(
    user: { id: string; role: string; areaId?: string | null },
    areaId?: string,
    search?: string,
  ) {
    const scopedAreaId = user.role === 'ADVERTISER' ? user.areaId : areaId;
    const where: any = {};

    if (scopedAreaId) {
      where.coupon = { areaId: scopedAreaId };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { phoneNumber: { contains: term, mode: 'insensitive' } } },
        { coupon: { title: { contains: term, mode: 'insensitive' } } },
        { coupon: { couponCode: { contains: term, mode: 'insensitive' } } },
        { coupon: { merchant: { name: { contains: term, mode: 'insensitive' } } } },
        { coupon: { area: { name: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [items, total, todayCount, thisWeekCount] = await Promise.all([
      this.prisma.savedCoupon.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
          coupon: {
            select: {
              id: true,
              title: true,
              couponCode: true,
              imageUrl: true,
              area: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                },
              },
              merchant: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.savedCoupon.count({ where }),
      this.prisma.savedCoupon.count({
        where: {
          ...(scopedAreaId ? { coupon: { areaId: scopedAreaId } } : {}),
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.savedCoupon.count({
        where: {
          ...(scopedAreaId ? { coupon: { areaId: scopedAreaId } } : {}),
          createdAt: { gte: weekStart },
        },
      }),
    ]);

    return {
      items,
      total,
      todayCount,
      thisWeekCount,
    };
  }

  async shareAnalytics(
    user: { id: string; role: string; areaId?: string | null },
    areaId?: string,
    search?: string,
  ) {
    const scopedAreaId = user.role === 'ADVERTISER' ? user.areaId : areaId;
    const where: any = {};

    if (scopedAreaId) {
      where.coupon = { areaId: scopedAreaId };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { coupon: { title: { contains: term, mode: 'insensitive' } } },
        { coupon: { couponCode: { contains: term, mode: 'insensitive' } } },
        { coupon: { merchant: { name: { contains: term, mode: 'insensitive' } } } },
        { coupon: { area: { name: { contains: term, mode: 'insensitive' } } } },
        { channel: { contains: term, mode: 'insensitive' } },
      ];
    }

    const events = await this.prisma.couponShareEvent.findMany({
      where,
      include: {
        coupon: {
          select: {
            id: true,
            title: true,
            couponCode: true,
            area: { select: { id: true, name: true, city: true } },
            merchant: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const rowMap = new Map<string, any>();
    const channelMap = new Map<string, { channel: string; shares: number; opens: number }>();

    for (const event of events) {
      const channel = event.channel || 'SYSTEM';
      const key = `${event.couponId}:${channel}`;
      const row = rowMap.get(key) || {
        couponId: event.couponId,
        couponTitle: event.coupon.title,
        couponCode: event.coupon.couponCode,
        businessName: event.coupon.merchant?.name || null,
        areaName: event.coupon.area?.name || null,
        channel,
        shares: 0,
        opens: 0,
        lastActivityAt: event.createdAt,
      };

      const channelTotals = channelMap.get(channel) || { channel, shares: 0, opens: 0 };

      if (event.eventType === 'OPEN') {
        row.opens += 1;
        channelTotals.opens += 1;
      } else {
        row.shares += 1;
        channelTotals.shares += 1;
      }

      if (event.createdAt > row.lastActivityAt) {
        row.lastActivityAt = event.createdAt;
      }

      rowMap.set(key, row);
      channelMap.set(channel, channelTotals);
    }

    const rows = Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        openRate: row.shares > 0 ? row.opens / row.shares : 0,
      }))
      .sort((a, b) => b.shares + b.opens - (a.shares + a.opens));

    const byChannel = Array.from(channelMap.values())
      .map((row) => ({
        ...row,
        openRate: row.shares > 0 ? row.opens / row.shares : 0,
      }))
      .sort((a, b) => b.shares + b.opens - (a.shares + a.opens));

    return {
      rows,
      byChannel,
      totalShares: rows.reduce((sum, row) => sum + row.shares, 0),
      totalOpens: rows.reduce((sum, row) => sum + row.opens, 0),
    };
  }
}
