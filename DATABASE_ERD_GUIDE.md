# CityDeals Enterprise Database Architecture & ERD Specification

This document details the production database architecture of the CityDeals PostgreSQL database managed via Prisma ORM.

You can open the diagram directly in the **Draw.io Desktop App**:
- Backend Path: [`citydeals-backend/citydeals-erd.drawio`](./citydeals-erd.drawio)
- Root Path: [`citydeals-erd.drawio`](../citydeals-erd.drawio)

---

## 1. Enterprise Architecture Overview

- **Engine:** PostgreSQL 16+
- **ORM / Migration:** Prisma ORM
- **Entities:** 20 Production Tables
- **Foreign Keys:** 21 Referential Integrity Relationships
- **Notation:** Crow's Foot Notation (`1 .. 0..*`, `1 .. 1`, `0..1 .. 0..*`)
- **Row Columns:** `[ Key Badge (PK/FK/UQ) | Attribute Name | PostgreSQL Data Type & Nullability ]`
- **Table Footers:** Composite Indexes, Unique Constraints, and Query Optimizations

---

## 2. Functional Domains & Subsystems

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CITYDEALS CORE PLATFORM                                 │
├─────────────────────┬──────────────────────┬────────────────────┬──────────────────────┤
│ 1. Geo & Directory  │ 2. Identity & Access │ 3. Deals Engine    │ 4. Analytics & Loyalty│
├─────────────────────┼──────────────────────┼────────────────────┼──────────────────────┤
│ • Area              │ • User               │ • Coupon           │ • SavedCoupon        │
│ • Category          │ • RegistrationOtp    │ • BirthdayGift     │ • CouponRedemption   │
│ • Merchant          │ • StaffAccount       │ • BirthdayClaim    │ • CouponShareEvent   │
│                     │ • StaffRole (RBAC)   │                    │ • CouponViewEvent    │
├─────────────────────┴──────────────────────┴────────────────────┴──────────────────────┤
│ 5. Notifications & Discovery: Notification, NotificationCooldown, SupportTicket        │
│ 6. Configuration & Legal: AppSetting, LegalDocument, LegalContent                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Relational Foreign Key Matrix

| Source Model (Parent) | Target Model (Child) | Foreign Key Field | Cardinality | Business Logic / Cascade Rule |
|---|---|---|---|---|
| **Area** | User | `User.areaId` | `1` to `0..*` | Default metropolitan area for user geofencing |
| **Area** | Merchant | `Merchant.areaId` | `1` to `0..*` | Store physical operating location |
| **Area** | Coupon | `Coupon.areaId` | `1` to `0..*` | Targeted deals for area residents |
| **Category** | Merchant | `Merchant.categoryId` | `0..1` to `0..*` | Business classification |
| **Category** | Coupon | `Coupon.categoryId` | `0..1` to `0..*` | Deal search & filter taxonomy |
| **User** | Merchant | `Merchant.ownerId` | `0..1` to `0..*` | Advertiser business ownership |
| **User** | SavedCoupon | `SavedCoupon.userId` | `1` to `0..*` | Bookmarked deals (Composite unique: `userId` + `couponId`) |
| **User** | CouponRedemption | `CouponRedemption.userId` | `1` to `0..*` | In-store redemption tracking |
| **User** | Notification | `Notification.userId` | `1` to `0..*` | Push & in-app message inbox |
| **User** | NotificationCooldown | `NotificationCooldown.userId` | `1` to `0..*` | Prevents notification spam per merchant (`userId` + `merchantId`) |
| **User** | SupportTicket | `SupportTicket.userId` | `0..1` to `0..*` | Customer inquiries (null for guest submissions) |
| **User** | BirthdayClaim | `BirthdayClaim.userId` | `1` to `0..*` | Annual birthday gift claims (`userId` + `giftId` + `year`) |
| **Merchant** | Coupon | `Coupon.merchantId` | `1` to `0..*` | Deals published by merchant |
| **Merchant** | NotificationCooldown | `NotificationCooldown.merchantId` | `1` to `0..*` | Merchant geofence trigger cooldown |
| **Merchant** | BirthdayGift | `BirthdayGift.merchantId` | `1` to `0..*` | Merchant birthday voucher campaigns |
| **Coupon** | SavedCoupon | `SavedCoupon.couponId` | `1` to `0..*` | Saved bookmarks aggregate count |
| **Coupon** | CouponRedemption | `CouponRedemption.couponId` | `1` to `0..*` | Deal redemption limit enforcement |
| **Coupon** | CouponShareEvent | `CouponShareEvent.couponId` | `1` to `0..*` | Referral channel analytics (WhatsApp, Web, App) |
| **Coupon** | CouponViewEvent | `CouponViewEvent.couponId` | `1` to `0..*` | Conversion funnel & impression count |
| **Coupon** | BirthdayGift | `BirthdayGift.couponId` | `0..1` to `0..*` | Optional promo link for birthday gifts |
| **BirthdayGift** | BirthdayClaim | `BirthdayClaim.giftId` | `1` to `0..*` | Individual claims validated via hashed code |

---

## 4. How to Open & Navigate in Draw.io

1. Open your **Draw.io Desktop App**.
2. Select **Open Existing Diagram** (`Ctrl + O`).
3. Choose [`citydeals-backend/citydeals-erd.drawio`](./citydeals-erd.drawio).
4. **Features available:**
   - **Executive Header & Legend:** Clearly explains all notations and field keys.
   - **Color-Coded Domains:** Easily isolate Geo, Identity, Deals, Analytics, or Birthday modules.
   - **Data Types & Nullability:** PostgreSQL data types, string lengths, and nullability constraints.
   - **Interactive Connectors:** Hovering or selecting any table highlights all its related foreign keys.
