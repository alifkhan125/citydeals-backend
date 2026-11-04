import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CouponsService } from './coupons.service.js';
import { nextRedemptionAt } from './redemption-policy.js';

describe('coupon redemption frequency', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  let service: CouponsService;
  let coupon: any;
  let latest: { createdAt: Date } | null;
  let prisma: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    coupon = { id: 'coupon', status: 'ACTIVE', couponCode: 'SHOP-123', redemptionFrequency: 'DAILY', merchant: { name: 'Shop' } };
    latest = null;
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      coupon: { findUnique: vi.fn().mockImplementation(async () => coupon) },
      savedCoupon: { findFirst: vi.fn().mockResolvedValue(null) },
      couponRedemption: {
        findFirst: vi.fn().mockImplementation(async () => latest),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'redemption', createdAt: now }),
      },
    };
    service = new CouponsService(prisma, {} as never);
  });

  afterEach(() => vi.useRealTimers());

  it.each(['HOURLY', 'DAILY', 'WEEKLY'])('%s returns the same next time after redeem and detail reload', async (frequency) => {
    coupon.redemptionFrequency = frequency;
    const result = await service.redeemCoupon('user', 'coupon', 'shop-123');
    latest = { createdAt: now };
    const detail = await service.findById('coupon', 'user');
    expect(result.redemptionAvailableAt).toEqual(nextRedemptionAt(frequency, now));
    expect(detail.redemptionAvailableAt).toEqual(result.redemptionAvailableAt);
    expect(detail.isRedeemed).toBe(true);
  });

  it.each(['HOURLY', 'DAILY', 'WEEKLY'])('%s rejects repeat redemption during its own waiting period', async (frequency) => {
    coupon.redemptionFrequency = frequency;
    latest = { createdAt: new Date(now.getTime() - 60_000) };
    await expect(service.redeemCoupon('user', 'coupon', 'SHOP-123')).rejects.toThrow('again after');
    expect(prisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it.each(['HOURLY', 'DAILY', 'WEEKLY'])('%s allows redemption exactly when its waiting period ends', async (frequency) => {
    coupon.redemptionFrequency = frequency;
    latest = { createdAt: now };
    vi.setSystemTime(nextRedemptionAt(frequency, now)!);
    await expect(service.redeemCoupon('user', 'coupon', 'SHOP-123')).resolves.toMatchObject({ success: true });
  });

  it('ONE_TIME stays redeemed permanently', async () => {
    coupon.redemptionFrequency = 'ONE_TIME';
    latest = { createdAt: new Date('2020-01-01T00:00:00Z') };
    await expect(service.redeemCoupon('user', 'coupon', 'SHOP-123')).rejects.toThrow('already redeemed');
    expect(prisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('UNLIMITED allows immediate repeat redemption without a waiting time', async () => {
    coupon.redemptionFrequency = 'UNLIMITED';
    latest = { createdAt: now };
    await expect(service.redeemCoupon('user', 'coupon', 'SHOP-123')).resolves.toMatchObject({ success: true, redemptionAvailableAt: null });
  });

  it('preserves total redemption limits even for unlimited frequency', async () => {
    coupon.redemptionFrequency = 'UNLIMITED';
    coupon.redemptionLimit = 2;
    prisma.couponRedemption.count.mockResolvedValue(2);
    await expect(service.redeemCoupon('user', 'coupon', 'SHOP-123')).rejects.toThrow('total redemption limit');
    expect(prisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it.each(['BANNED', 'SUSPENDED'])('still blocks %s users', async (status) => {
    prisma.user.findUnique.mockResolvedValue({ status });
    await expect(service.redeemCoupon('user', 'coupon', 'SHOP-123')).rejects.toThrow(status.toLowerCase());
  });

  it('rejects an invalid coupon code before creating a redemption', async () => {
    await expect(service.redeemCoupon('user', 'coupon', 'WRONG-CODE')).rejects.toThrow('Invalid coupon code');
    expect(prisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('DAILY resets at the next server calendar midnight', () => {
    const redeemedAt = new Date(2026, 10, 2, 23, 59);
    expect(nextRedemptionAt('DAILY', redeemedAt)).toEqual(new Date(2026, 10, 3));
  });

  it('HOURLY waits one hour and WEEKLY waits seven days', () => {
    expect(nextRedemptionAt('HOURLY', now)?.getTime()).toBe(now.getTime() + 3_600_000);
    expect(nextRedemptionAt('WEEKLY', now)?.getTime()).toBe(now.getTime() + 604_800_000);
  });
});
