/** DAILY retains the existing server calendar-day policy; WEEKLY is seven days. */
export function nextRedemptionAt(frequency: string, redeemedAt: Date): Date | null {
  switch (frequency) {
    case 'HOURLY':
      return new Date(redeemedAt.getTime() + 60 * 60 * 1000);
    case 'DAILY': {
      const next = new Date(redeemedAt);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case 'WEEKLY':
      return new Date(redeemedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}
