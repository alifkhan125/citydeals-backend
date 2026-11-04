CREATE TYPE "BirthdayGiftStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');
CREATE TYPE "BirthdayClaimStatus" AS ENUM ('CLAIMED', 'REDEEMED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "BirthdayGift" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "terms" TEXT,
  "imageUrl" TEXT,
  "category" TEXT,
  "merchantId" TEXT NOT NULL,
  "couponId" TEXT,
  "status" "BirthdayGiftStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "claimLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BirthdayGift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BirthdayClaim" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "giftId" TEXT NOT NULL,
  "birthdayYear" INTEGER NOT NULL,
  "status" "BirthdayClaimStatus" NOT NULL DEFAULT 'CLAIMED',
  "claimCodeHash" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt" TIMESTAMP(3),
  "validatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BirthdayClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BirthdayClaim_claimCodeHash_key" ON "BirthdayClaim"("claimCodeHash");
CREATE UNIQUE INDEX "BirthdayClaim_userId_giftId_birthdayYear_key" ON "BirthdayClaim"("userId", "giftId", "birthdayYear");
CREATE INDEX "BirthdayGift_status_startsAt_expiresAt_idx" ON "BirthdayGift"("status", "startsAt", "expiresAt");
CREATE INDEX "BirthdayGift_merchantId_status_idx" ON "BirthdayGift"("merchantId", "status");
CREATE INDEX "BirthdayGift_couponId_idx" ON "BirthdayGift"("couponId");
CREATE INDEX "BirthdayClaim_giftId_status_idx" ON "BirthdayClaim"("giftId", "status");
CREATE INDEX "BirthdayClaim_userId_birthdayYear_idx" ON "BirthdayClaim"("userId", "birthdayYear");

ALTER TABLE "BirthdayGift" ADD CONSTRAINT "BirthdayGift_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BirthdayGift" ADD CONSTRAINT "BirthdayGift_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BirthdayClaim" ADD CONSTRAINT "BirthdayClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BirthdayClaim" ADD CONSTRAINT "BirthdayClaim_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "BirthdayGift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
