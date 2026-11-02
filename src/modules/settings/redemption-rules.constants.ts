export const REDEMPTION_COOLDOWN_MINUTES_KEY = 'redemptionCooldownMinutes';
export const DAILY_REDEMPTION_LIMIT_KEY = 'dailyRedemptionLimit';

export const DEFAULT_REDEMPTION_RULES = {
  cooldownValue: 0,
  cooldownUnit: 'DAILY' as const,
  dailyLimit: 0,
};
