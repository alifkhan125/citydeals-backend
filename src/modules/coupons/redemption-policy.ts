/**
 * Calculates next redemption date:
 * - HOURLY: 1 hour (3,600,000 ms)
 * - DAILY: Next server calendar midnight (00:00:00 of the following day)
 * - WEEKLY: 7 days (604,800,000 ms)
 * - UNLIMITED / ONE_TIME: null
 */
export function nextRedemptionAt(frequency: string, redeemedAt: Date): Date | null {
  const redeemed = new Date(redeemedAt);
  if (isNaN(redeemed.getTime())) return null;

  switch (frequency?.toUpperCase()) {
    case 'HOURLY':
      return new Date(redeemed.getTime() + 60 * 60 * 1000);
    case 'DAILY': {
      const next = new Date(redeemed);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case 'WEEKLY':
      return new Date(redeemed.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'MONTHLY': {
      const next = new Date(redeemed);
      next.setMonth(next.getMonth() + 1);
      return next;
    }
    case 'UNLIMITED':
    case 'ONE_TIME':
    default:
      return null;
  }
}
