CREATE INDEX IF NOT EXISTS "Coupon_isDeleted_status_createdAt_idx"
  ON "Coupon" ("isDeleted", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Coupon_merchantId_isDeleted_idx"
  ON "Coupon" ("merchantId", "isDeleted");

CREATE INDEX IF NOT EXISTS "Coupon_areaId_isDeleted_idx"
  ON "Coupon" ("areaId", "isDeleted");

CREATE INDEX IF NOT EXISTS "Merchant_isDeleted_status_name_idx"
  ON "Merchant" ("isDeleted", "status", "name");

CREATE INDEX IF NOT EXISTS "Merchant_areaId_isDeleted_idx"
  ON "Merchant" ("areaId", "isDeleted");

CREATE INDEX IF NOT EXISTS "Area_isDeleted_name_idx"
  ON "Area" ("isDeleted", "name");

CREATE INDEX IF NOT EXISTS "Area_city_state_idx"
  ON "Area" ("city", "state");
