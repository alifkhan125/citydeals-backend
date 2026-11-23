-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Coupon_isPinned_idx" ON "Coupon"("isPinned");
