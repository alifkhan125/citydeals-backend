CREATE TYPE "CouponAudience" AS ENUM ('ALL_USERS', 'BIRTHDAY_USERS_ONLY', 'ALL_USERS_AND_BIRTHDAY_GIFT');
ALTER TABLE "Coupon" ADD COLUMN "audience" "CouponAudience" NOT NULL DEFAULT 'ALL_USERS';
CREATE INDEX "Coupon_audience_status_idx" ON "Coupon"("audience", "status");
