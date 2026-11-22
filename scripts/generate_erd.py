import html
import os

# ─────────────────────────────────────────────────────────────────────────────
# 20 PRISMA MODELS WITH FULL POSTGRESQL ATTRIBUTE DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────
models = [
    # ── ZONE 1: GEOGRAPHY & CORE DIRECTORY ──
    {
        "name": "Area",
        "domain": "GEOGRAPHY & LOCALITY ENGINE",
        "header_bg": "#1e4620", "header_fg": "#ffffff",
        "border_color": "#2e7d32", "badge_bg": "#e8f5e9",
        "x": 80, "y": 180, "w": 380,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "slug", "VARCHAR(255)", "NOT NULL", "Unique URI slug"),
            ("REQ", "name", "VARCHAR(255)", "NOT NULL", "Area name"),
            ("REQ", "city", "VARCHAR(128)", "NOT NULL", "City name"),
            ("REQ", "state", "VARCHAR(128)", "NOT NULL", "State / Province"),
            ("REQ", "latitude", "DECIMAL(9,6)", "NOT NULL", "Center point lat"),
            ("REQ", "longitude", "DECIMAL(9,6)", "NOT NULL", "Center point lng"),
            ("REQ", "radiusMeters", "INTEGER", "NOT NULL", "Default: 10,000 m"),
            ("REQ", "isDeleted", "BOOLEAN", "NOT NULL", "Soft delete (Default: false)"),
            ("OPT", "qrCodeUrl", "TEXT", "NULL", "Area QR code link"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["INDEX (slug)", "INDEX (isDeleted, name)", "INDEX (city, state)"]
    },
    {
        "name": "Category",
        "domain": "CATALOG TAXONOMY",
        "header_bg": "#1e4620", "header_fg": "#ffffff",
        "border_color": "#2e7d32", "badge_bg": "#e8f5e9",
        "x": 80, "y": 620, "w": 380,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "slug", "VARCHAR(255)", "NOT NULL", "Unique URI slug"),
            ("REQ", "name", "VARCHAR(255)", "NOT NULL", "Category display name"),
            ("OPT", "iconUrl", "TEXT", "NULL", "CDN icon path"),
            ("OPT", "description", "TEXT", "NULL", "Category description"),
            ("REQ", "status", "ENUM", "NOT NULL", "ACTIVE | INACTIVE"),
            ("REQ", "isDeleted", "BOOLEAN", "NOT NULL", "Soft delete (Default: false)"),
            ("REQ", "sortOrder", "INTEGER", "NOT NULL", "Default: 0"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["INDEX (slug)"]
    },
    {
        "name": "Merchant",
        "domain": "BUSINESS & ADVERTISERS",
        "header_bg": "#0f4c81", "header_fg": "#ffffff",
        "border_color": "#1976d2", "badge_bg": "#e3f2fd",
        "x": 80, "y": 1020, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "areaId", "UUID", "NOT NULL", "FK -> Area.id"),
            ("FK", "categoryId", "UUID", "NULL", "FK -> Category.id"),
            ("FK", "ownerId", "UUID", "NULL", "FK -> User.id (Advertiser)"),
            ("REQ", "name", "VARCHAR(255)", "NOT NULL", "Store / Merchant name"),
            ("OPT", "titleText", "VARCHAR(255)", "NULL", "Headline / Punchline"),
            ("OPT", "description", "TEXT", "NULL", "Store profile text"),
            ("OPT", "logoUrl", "TEXT", "NULL", "Logo image URL"),
            ("REQ", "address", "TEXT", "NOT NULL", "Physical store address"),
            ("OPT", "phone", "VARCHAR(64)", "NULL", "Business telephone"),
            ("OPT", "email", "VARCHAR(255)", "NULL", "Business email address"),
            ("OPT", "websiteUrl", "TEXT", "NULL", "Official website"),
            ("OPT", "instagramUrl", "TEXT", "NULL", "Social profile"),
            ("OPT", "facebookUrl", "TEXT", "NULL", "Social profile"),
            ("OPT", "tiktokUrl", "TEXT", "NULL", "Social profile"),
            ("REQ", "radiusMeters", "INTEGER", "NOT NULL", "Geo fence radius (3000m)"),
            ("REQ", "status", "ENUM", "NOT NULL", "ACTIVE | INACTIVE"),
            ("REQ", "isDeleted", "BOOLEAN", "NOT NULL", "Soft delete (Default: false)"),
            ("REQ", "latitude", "DECIMAL(9,6)", "NOT NULL", "Geo coordinates"),
            ("REQ", "longitude", "DECIMAL(9,6)", "NOT NULL", "Geo coordinates"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["INDEX (areaId)", "INDEX (categoryId)", "INDEX (isDeleted, status, name)", "INDEX (areaId, isDeleted)"]
    },

    # ── ZONE 2: USERS, AUTH & STAFF RBAC ──
    {
        "name": "User",
        "domain": "USER IDENTITY & AUTHENTICATION",
        "header_bg": "#4a148c", "header_fg": "#ffffff",
        "border_color": "#7b1fa2", "badge_bg": "#f3e5f5",
        "x": 540, "y": 180, "w": 440,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "email", "VARCHAR(255)", "NOT NULL", "Unique registered email"),
            ("UQ", "appleSubject", "VARCHAR(255)", "NULL", "Apple Sign-In Unique ID"),
            ("OPT", "fullName", "VARCHAR(255)", "NULL", "User full name"),
            ("OPT", "phoneNumber", "VARCHAR(64)", "NULL", "Phone number"),
            ("OPT", "profilePictureUrl", "TEXT", "NULL", "Avatar URL"),
            ("OPT", "dateOfBirth", "DATE", "NULL", "Used for Birthday Gifts"),
            ("REQ", "passwordHash", "TEXT", "NOT NULL", "Bcrypt password hash"),
            ("REQ", "role", "ENUM", "NOT NULL", "USER | ADMIN | ADVERTISER"),
            ("REQ", "status", "ENUM", "NOT NULL", "ACTIVE | SUSPENDED | BANNED"),
            ("FK", "areaId", "UUID", "NULL", "FK -> Area.id (Default city)"),
            ("REQ", "notificationsPaused", "BOOLEAN", "NOT NULL", "Default: false"),
            ("REQ", "notificationRadiusMeters", "INTEGER", "NOT NULL", "Default: 2000 m"),
            ("REQ", "preferredLanguage", "VARCHAR(8)", "NOT NULL", "Default: 'en'"),
            ("REQ", "acceptedTerms", "BOOLEAN", "NOT NULL", "Terms consent flag"),
            ("REQ", "onboardingCompleted", "BOOLEAN", "NOT NULL", "Onboarding flag"),
            ("OPT", "refreshTokenHash", "TEXT", "NULL", "Hashed JWT refresh token"),
            ("OPT", "resetPasswordOtp", "VARCHAR(16)", "NULL", "Recovery OTP code"),
            ("OPT", "resetPasswordExpiresAt", "TIMESTAMPTZ", "NULL", "OTP expiration time"),
            ("OPT", "latitude", "DECIMAL(9,6)", "NULL", "Last known coordinates"),
            ("OPT", "longitude", "DECIMAL(9,6)", "NULL", "Last known coordinates"),
            ("OPT", "fcmToken", "TEXT", "NULL", "Firebase Cloud Messaging Token"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
            ("OPT", "deletedAt", "TIMESTAMPTZ", "NULL", "Soft delete timestamp"),
        ],
        "constraints": ["UNIQUE (email)", "UNIQUE (appleSubject)", "INDEX (areaId)", "INDEX (role, status)"]
    },
    {
        "name": "RegistrationOtp",
        "domain": "AUTH ONBOARDING VERIFICATION",
        "header_bg": "#4a148c", "header_fg": "#ffffff",
        "border_color": "#7b1fa2", "badge_bg": "#f3e5f5",
        "x": 540, "y": 920, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "email", "VARCHAR(255)", "NOT NULL", "Target signup email"),
            ("REQ", "otp", "VARCHAR(16)", "NOT NULL", "Hashed OTP verification code"),
            ("REQ", "payloadJson", "TEXT", "NOT NULL", "Cached pending signup data"),
            ("REQ", "expiresAt", "TIMESTAMPTZ", "NOT NULL", "OTP expiration deadline"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["UNIQUE (email)", "INDEX (expiresAt)"]
    },
    {
        "name": "StaffAccount",
        "domain": "STAFF ACCESS MANAGEMENT",
        "header_bg": "#37474f", "header_fg": "#ffffff",
        "border_color": "#546e7a", "badge_bg": "#eceff1",
        "x": 1040, "y": 180, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "email", "VARCHAR(255)", "NOT NULL", "Corporate staff email"),
            ("REQ", "fullName", "VARCHAR(255)", "NOT NULL", "Staff member name"),
            ("REQ", "roleKey", "VARCHAR(64)", "NOT NULL", "Role key -> StaffRole.key"),
            ("REQ", "status", "ENUM", "NOT NULL", "ACTIVE | SUSPENDED | DELETED"),
            ("REQ", "isDeleted", "BOOLEAN", "NOT NULL", "Soft delete (Default: false)"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["UNIQUE (email)", "INDEX (roleKey)"]
    },
    {
        "name": "StaffRole",
        "domain": "RBAC PERMISSIONS MATRIX",
        "header_bg": "#37474f", "header_fg": "#ffffff",
        "border_color": "#546e7a", "badge_bg": "#eceff1",
        "x": 1040, "y": 450, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "key", "VARCHAR(64)", "NOT NULL", "Role slug (administrator, manager)"),
            ("UQ", "name", "VARCHAR(128)", "NOT NULL", "Display name"),
            ("REQ", "permissions", "JSONB", "NOT NULL", "Permission matrix object"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["UNIQUE (key)", "UNIQUE (name)"]
    },

    # ── ZONE 3: COUPONS & DEALS ENGINE ──
    {
        "name": "Coupon",
        "domain": "PROMOTIONS & COUPONS ENGINE",
        "header_bg": "#0d47a1", "header_fg": "#ffffff",
        "border_color": "#1565c0", "badge_bg": "#e3f2fd",
        "x": 540, "y": 1200, "w": 440,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "merchantId", "UUID", "NOT NULL", "FK -> Merchant.id"),
            ("FK", "areaId", "UUID", "NOT NULL", "FK -> Area.id"),
            ("FK", "categoryId", "UUID", "NULL", "FK -> Category.id"),
            ("UQ", "shareSlug", "VARCHAR(255)", "NOT NULL", "Unique share link slug"),
            ("REQ", "title", "VARCHAR(255)", "NOT NULL", "Deal title"),
            ("REQ", "description", "TEXT", "NOT NULL", "Deal full description"),
            ("OPT", "imageUrl", "TEXT", "NULL", "CDN promotional banner"),
            ("OPT", "couponCode", "VARCHAR(64)", "NULL", "Discount voucher code"),
            ("OPT", "couponLink", "TEXT", "NULL", "External affiliate / site URL"),
            ("OPT", "redemptionLimit", "INTEGER", "NULL", "Max total redemptions allowed"),
            ("REQ", "redemptionFrequency", "ENUM", "NOT NULL", "ONE_TIME | HOURLY | DAILY.."),
            ("OPT", "discussion", "TEXT", "NULL", "Terms discussion notes"),
            ("OPT", "terms", "TEXT", "NULL", "Official terms & conditions"),
            ("REQ", "status", "ENUM", "NOT NULL", "ACTIVE | ARCHIVED | EXPIRED"),
            ("REQ", "audience", "ENUM", "NOT NULL", "ALL_USERS | BIRTHDAY_USERS.."),
            ("REQ", "priority", "INTEGER", "NOT NULL", "Sort rank (Default: 0)"),
            ("REQ", "isWhitelisted", "BOOLEAN", "NOT NULL", "VIP whitelist flag"),
            ("REQ", "isDeleted", "BOOLEAN", "NOT NULL", "Soft delete flag"),
            ("OPT", "startsAt", "TIMESTAMPTZ", "NULL", "Deal activation schedule"),
            ("OPT", "expiresAt", "TIMESTAMPTZ", "NULL", "Deal expiry schedule"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["UNIQUE (shareSlug)", "INDEX (priority)", "INDEX (areaId, status)", "INDEX (merchantId, isDeleted)"]
    },

    # ── ZONE 4: USER ACTIVITY, REDEMPTIONS & METRICS ──
    {
        "name": "SavedCoupon",
        "domain": "USER ENGAGEMENT BOOKMARKS",
        "header_bg": "#bf360c", "header_fg": "#ffffff",
        "border_color": "#e64a19", "badge_bg": "#fbe9e7",
        "x": 1040, "y": 720, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "userId", "UUID", "NOT NULL", "FK -> User.id"),
            ("FK", "couponId", "UUID", "NOT NULL", "FK -> Coupon.id"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Saved timestamp"),
        ],
        "constraints": ["UNIQUE (userId, couponId)", "INDEX (userId)", "INDEX (couponId)"]
    },
    {
        "name": "CouponRedemption",
        "domain": "TRANSACTION REDEMPTION AUDIT",
        "header_bg": "#bf360c", "header_fg": "#ffffff",
        "border_color": "#e64a19", "badge_bg": "#fbe9e7",
        "x": 1040, "y": 920, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "userId", "UUID", "NOT NULL", "FK -> User.id"),
            ("FK", "couponId", "UUID", "NOT NULL", "FK -> Coupon.id"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Redemption timestamp"),
        ],
        "constraints": ["INDEX (userId)", "INDEX (couponId)", "INDEX (createdAt)"]
    },
    {
        "name": "CouponShareEvent",
        "domain": "SOCIAL REFERRAL ANALYTICS",
        "header_bg": "#bf360c", "header_fg": "#ffffff",
        "border_color": "#e64a19", "badge_bg": "#fbe9e7",
        "x": 1040, "y": 1120, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "couponId", "UUID", "NOT NULL", "FK -> Coupon.id"),
            ("REQ", "channel", "VARCHAR(64)", "NOT NULL", "WHATSAPP, FACEBOOK, COPY_LINK"),
            ("REQ", "eventType", "VARCHAR(64)", "NOT NULL", "SHARE | OPEN (Default: SHARE)"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Event timestamp"),
        ],
        "constraints": ["INDEX (couponId)", "INDEX (channel)", "INDEX (eventType)", "INDEX (createdAt)"]
    },
    {
        "name": "CouponViewEvent",
        "domain": "IMPRESSIONS & CONVERSION FUNNEL",
        "header_bg": "#bf360c", "header_fg": "#ffffff",
        "border_color": "#e64a19", "badge_bg": "#fbe9e7",
        "x": 1040, "y": 1330, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "couponId", "UUID", "NOT NULL", "FK -> Coupon.id"),
            ("OPT", "userId", "UUID", "NULL", "Null for anonymous viewers"),
            ("REQ", "source", "VARCHAR(64)", "NOT NULL", "APP | WEB_SHARE | QR"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "View timestamp"),
        ],
        "constraints": ["INDEX (couponId)", "INDEX (userId)", "INDEX (source)", "INDEX (createdAt)"]
    },

    # ── ZONE 5: BIRTHDAY REWARD SUBSYSTEM ──
    {
        "name": "BirthdayGift",
        "domain": "ANNUAL BIRTHDAY LOYALTY REWARDS",
        "header_bg": "#880e4f", "header_fg": "#ffffff",
        "border_color": "#c2185b", "badge_bg": "#fce4ec",
        "x": 540, "y": 1960, "w": 440,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "merchantId", "UUID", "NOT NULL", "FK -> Merchant.id"),
            ("FK", "couponId", "UUID", "NULL", "FK -> Coupon.id (Optional promo)"),
            ("REQ", "title", "VARCHAR(255)", "NOT NULL", "Gift campaign title"),
            ("REQ", "description", "TEXT", "NOT NULL", "Gift reward description"),
            ("OPT", "terms", "TEXT", "NULL", "Redemption terms"),
            ("OPT", "imageUrl", "TEXT", "NULL", "Voucher artwork URL"),
            ("OPT", "category", "VARCHAR(128)", "NULL", "Gift category tag"),
            ("REQ", "status", "ENUM", "NOT NULL", "ACTIVE | INACTIVE | EXPIRED"),
            ("OPT", "startsAt", "TIMESTAMPTZ", "NULL", "Campaign start date"),
            ("OPT", "expiresAt", "TIMESTAMPTZ", "NULL", "Campaign end date"),
            ("OPT", "claimLimit", "INTEGER", "NULL", "Max allowed annual claims"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["INDEX (status, startsAt, expiresAt)", "INDEX (merchantId, status)", "INDEX (couponId)"]
    },
    {
        "name": "BirthdayClaim",
        "domain": "BIRTHDAY REDEMPTION VERIFICATION",
        "header_bg": "#880e4f", "header_fg": "#ffffff",
        "border_color": "#c2185b", "badge_bg": "#fce4ec",
        "x": 1040, "y": 1960, "w": 420,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "userId", "UUID", "NOT NULL", "FK -> User.id"),
            ("FK", "giftId", "UUID", "NOT NULL", "FK -> BirthdayGift.id"),
            ("REQ", "birthdayYear", "INTEGER", "NOT NULL", "Prevents duplicate claim per year"),
            ("REQ", "status", "ENUM", "NOT NULL", "CLAIMED | REDEEMED | EXPIRED"),
            ("UQ", "claimCodeHash", "VARCHAR(255)", "NOT NULL", "Hashed merchant verification code"),
            ("REQ", "claimedAt", "TIMESTAMPTZ", "NOT NULL", "Claim timestamp"),
            ("OPT", "redeemedAt", "TIMESTAMPTZ", "NULL", "In-store scan timestamp"),
            ("OPT", "validatedBy", "VARCHAR(128)", "NULL", "Merchant staff identifier"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["UNIQUE (userId, giftId, birthdayYear)", "UNIQUE (claimCodeHash)", "INDEX (giftId, status)"]
    },

    # ── ZONE 6: NOTIFICATIONS & DISCOVERY ──
    {
        "name": "Notification",
        "domain": "PUSH & IN-APP NOTIFICATIONS",
        "header_bg": "#01579b", "header_fg": "#ffffff",
        "border_color": "#0288d1", "badge_bg": "#e1f5fe",
        "x": 1520, "y": 180, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "userId", "UUID", "NOT NULL", "FK -> User.id"),
            ("REQ", "title", "VARCHAR(255)", "NOT NULL", "Notification title"),
            ("REQ", "body", "TEXT", "NOT NULL", "Notification message body"),
            ("OPT", "data", "JSONB", "NULL", "Deep-link metadata payload"),
            ("OPT", "readAt", "TIMESTAMPTZ", "NULL", "Read receipt timestamp"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
        ],
        "constraints": ["INDEX (userId, readAt, createdAt)"]
    },
    {
        "name": "NotificationCooldown",
        "domain": "GEOFENCE NOTIFICATION THROTTLING",
        "header_bg": "#01579b", "header_fg": "#ffffff",
        "border_color": "#0288d1", "badge_bg": "#e1f5fe",
        "x": 1520, "y": 450, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "userId", "UUID", "NOT NULL", "FK -> User.id"),
            ("FK", "merchantId", "UUID", "NOT NULL", "FK -> Merchant.id"),
            ("REQ", "lastSentAt", "TIMESTAMPTZ", "NOT NULL", "Rate-limit timestamp"),
        ],
        "constraints": ["UNIQUE (userId, merchantId)"]
    },
    {
        "name": "SupportTicket",
        "domain": "CUSTOMER HELP DESK",
        "header_bg": "#01579b", "header_fg": "#ffffff",
        "border_color": "#0288d1", "badge_bg": "#e1f5fe",
        "x": 1520, "y": 680, "w": 400,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("FK", "userId", "UUID", "NULL", "FK -> User.id (Null for guests)"),
            ("REQ", "fullName", "VARCHAR(255)", "NOT NULL", "Requester name"),
            ("REQ", "email", "VARCHAR(255)", "NOT NULL", "Contact email"),
            ("REQ", "message", "TEXT", "NOT NULL", "Inquiry / Issue description"),
            ("OPT", "response", "TEXT", "NULL", "Staff resolution / reply"),
            ("REQ", "status", "VARCHAR(32)", "NOT NULL", "OPEN | IN_PROGRESS | RESOLVED"),
            ("REQ", "createdAt", "TIMESTAMPTZ", "NOT NULL", "Default: now()"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["INDEX (userId)", "INDEX (status)"]
    },

    # ── ZONE 7: CONFIGURATION & LEGAL COMPLIANCE ──
    {
        "name": "AppSetting",
        "domain": "GLOBAL DYNAMIC SETTINGS",
        "header_bg": "#263238", "header_fg": "#ffffff",
        "border_color": "#455a64", "badge_bg": "#eceff1",
        "x": 1520, "y": 1030, "w": 380,
        "fields": [
            ("PK", "key", "VARCHAR(128)", "NOT NULL", "Config key (e.g. playStoreUrl)"),
            ("REQ", "value", "TEXT", "NOT NULL", "Config serialized value"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["PRIMARY KEY (key)"]
    },
    {
        "name": "LegalDocument",
        "domain": "VERSIONED LEGAL COMPLIANCE",
        "header_bg": "#263238", "header_fg": "#ffffff",
        "border_color": "#455a64", "badge_bg": "#eceff1",
        "x": 1520, "y": 1220, "w": 380,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "type", "VARCHAR(64)", "NOT NULL", "Doc slug (TERMS, PRIVACY)"),
            ("REQ", "title", "VARCHAR(255)", "NOT NULL", "Document heading"),
            ("REQ", "content", "TEXT", "NOT NULL", "Markdown / HTML content"),
            ("REQ", "version", "VARCHAR(32)", "NOT NULL", "Default: '1.0'"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Last published date"),
        ],
        "constraints": ["UNIQUE (type)"]
    },
    {
        "name": "LegalContent",
        "domain": "DYNAMIC LEGAL TEXT REPOSITORY",
        "header_bg": "#263238", "header_fg": "#ffffff",
        "border_color": "#455a64", "badge_bg": "#eceff1",
        "x": 1520, "y": 1470, "w": 380,
        "fields": [
            ("PK", "id", "UUID", "NOT NULL", "Primary Key (Default: uuid())"),
            ("UQ", "type", "VARCHAR(64)", "NOT NULL", "Content category identifier"),
            ("REQ", "title", "VARCHAR(255)", "NOT NULL", "Section title"),
            ("REQ", "content", "TEXT", "NOT NULL", "Long text payload"),
            ("REQ", "updatedAt", "TIMESTAMPTZ", "NOT NULL", "Auto-update"),
        ],
        "constraints": ["UNIQUE (type)"]
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# 21 RELATIONAL EDGES WITH EXACT CROW'S FOOT CARDINALITY & COLORS
# ─────────────────────────────────────────────────────────────────────────────
relationships = [
    # Geo -> User, Merchant, Coupon
    ("Area", "User", "1", "0..*", "users", "#2e7d32"),
    ("Area", "Merchant", "1", "0..*", "merchants", "#2e7d32"),
    ("Area", "Coupon", "1", "0..*", "coupons", "#2e7d32"),

    # Category -> Merchant, Coupon
    ("Category", "Merchant", "0..1", "0..*", "merchants", "#2e7d32"),
    ("Category", "Coupon", "0..1", "0..*", "coupons", "#2e7d32"),

    # User -> Merchant (Ownership)
    ("User", "Merchant", "0..1", "0..*", "ownedMerchants", "#7b1fa2"),

    # Merchant -> Coupon, Cooldown, BirthdayGift
    ("Merchant", "Coupon", "1", "0..*", "coupons", "#0f4c81"),
    ("Merchant", "NotificationCooldown", "1", "0..*", "cooldowns", "#0f4c81"),
    ("Merchant", "BirthdayGift", "1", "0..*", "birthdayGifts", "#0f4c81"),

    # User -> Activity & Subsystems
    ("User", "NotificationCooldown", "1", "0..*", "notificationCooldowns", "#7b1fa2"),
    ("User", "Notification", "1", "0..*", "notifications", "#7b1fa2"),
    ("User", "SavedCoupon", "1", "0..*", "savedCoupons", "#7b1fa2"),
    ("User", "CouponRedemption", "1", "0..*", "redemptions", "#7b1fa2"),
    ("User", "SupportTicket", "0..1", "0..*", "supportTickets", "#7b1fa2"),
    ("User", "BirthdayClaim", "1", "0..*", "birthdayClaims", "#7b1fa2"),

    # Coupon -> Events & Subsystems
    ("Coupon", "SavedCoupon", "1", "0..*", "savedBy", "#0d47a1"),
    ("Coupon", "CouponRedemption", "1", "0..*", "redemptions", "#0d47a1"),
    ("Coupon", "CouponShareEvent", "1", "0..*", "shareEvents", "#0d47a1"),
    ("Coupon", "CouponViewEvent", "1", "0..*", "viewEvents", "#0d47a1"),
    ("Coupon", "BirthdayGift", "0..1", "0..*", "linkedPromos", "#0d47a1"),

    # Birthday Subsystem
    ("BirthdayGift", "BirthdayClaim", "1", "0..*", "claims", "#880e4f"),
]

def generate_pro_erd():
    ROW_HEIGHT = 22
    HEADER_HEIGHT = 38
    FOOTER_HEIGHT = 24

    xml = []
    xml.append('<?xml version="1.0" encoding="UTF-8"?>')
    xml.append('<mxfile host="app.diagrams.net" modified="2026-11-22T17:00:00.000Z" agent="Antigravity Enterprise Architect" version="24.0.0" type="device">')
    xml.append('  <diagram id="citydeals_pro_erd" name="CityDeals Enterprise Database ERD">')
    xml.append('    <mxGraphModel dx="2800" dy="1800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2400" pageHeight="2600" background="#f8fafc" math="0" shadow="1">')
    xml.append('      <root>')
    xml.append('        <mxCell id="0" />')
    xml.append('        <mxCell id="1" parent="0" />')

    # ── EXECUTIVE HEADER & METADATA BAR ──
    header_box = (
        'roundRectangle;whiteSpace=wrap;html=1;arcSize=10;fillColor=#0f172a;strokeColor=#1e293b;strokeWidth=2;'
        'shadow=1;fontFamily=Helvetica;'
    )
    xml.append(f'        <mxCell id="exec_header" value="" style="{header_box}" vertex="1" parent="1">')
    xml.append('          <mxGeometry x="80" y="30" width="1840" height="95" as="geometry" />')
    xml.append('        </mxCell>')

    title_html = (
        '&lt;div style=&quot;font-family:Helvetica;color:#ffffff;&quot;&gt;'
        '&lt;div style=&quot;font-size:22px;font-weight:bold;letter-spacing:0.5px;&quot;&gt;CITYDEALS ENTERPRISE DATABASE ARCHITECTURE &amp;amp; ERD&lt;/div&gt;'
        '&lt;div style=&quot;font-size:12px;color:#94a3b8;margin-top:4px;&quot;&gt;Production Schema Specification &amp;bull; PostgreSQL 16 &amp;bull; Prisma ORM &amp;bull; 20 Production Entities &amp;bull; Strict Foreign Keys &amp;amp; Composite Indexes&lt;/div&gt;'
        '&lt;/div&gt;'
    )
    xml.append(f'        <mxCell id="exec_title" value="{title_html}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;" vertex="1" parent="exec_header">')
    xml.append('          <mxGeometry x="25" y="15" width="850" height="65" as="geometry" />')
    xml.append('        </mxCell>')

    # ── LEGEND BAR (CROW\'S FOOT KEY) ──
    legend_html = (
        '&lt;table cellpadding=&quot;2&quot; cellspacing=&quot;4&quot; style=&quot;font-family:Helvetica;font-size:11px;color:#cbd5e1;&quot;&gt;'
        '&lt;tr&gt;'
        '&lt;td&gt;&lt;span style=&quot;background-color:#ffe082;color:#b78103;padding:2px 5px;border-radius:3px;font-weight:bold;&quot;&gt;PK&lt;/span&gt; Primary Key&lt;/td&gt;'
        '&lt;td&gt;&lt;span style=&quot;background-color:#bbdefb;color:#1565c0;padding:2px 5px;border-radius:3px;font-weight:bold;&quot;&gt;FK&lt;/span&gt; Foreign Key&lt;/td&gt;'
        '&lt;td&gt;&lt;span style=&quot;background-color:#c8e6c9;color:#2e7d32;padding:2px 5px;border-radius:3px;font-weight:bold;&quot;&gt;UQ&lt;/span&gt; Unique Constraint&lt;/td&gt;'
        '&lt;td&gt;&lt;span style=&quot;color:#f87171;&quot;&gt;&amp;bull;&lt;/span&gt; NOT NULL&lt;/td&gt;'
        '&lt;td&gt;&lt;span style=&quot;color:#94a3b8;&quot;&gt;&amp;smallcircle;&lt;/span&gt; NULLABLE&lt;/td&gt;'
        '&lt;td&gt;&lt;span style=&quot;background-color:#334155;color:#f8fafc;padding:2px 6px;border-radius:3px;font-weight:bold;&quot;&gt;1 .. 0..*&lt;/span&gt; One-to-Many&lt;/td&gt;'
        '&lt;/tr&gt;'
        '&lt;/table&gt;'
    )
    xml.append(f'        <mxCell id="exec_legend" value="{legend_html}" style="text;html=1;strokeColor=none;fillColor=none;align=right;verticalAlign=middle;" vertex="1" parent="exec_header">')
    xml.append('          <mxGeometry x="900" y="20" width="900" height="55" as="geometry" />')
    xml.append('        </mxCell>')

    cell_counter = 100
    table_cell_map = {}

    for m in models:
        mname = m["name"]
        num_fields = len(m["fields"])
        has_constraints = len(m.get("constraints", [])) > 0
        footer_height = FOOTER_HEIGHT if has_constraints else 0
        total_height = HEADER_HEIGHT + (num_fields * ROW_HEIGHT) + footer_height + 4
        
        table_id = f"table_{mname}"
        table_cell_map[mname] = table_id

        # ── TABLE CONTAINER (SWIMLANE) ──
        domain_esc = html.escape(m["domain"])
        header_val = (
            f"&lt;div style=&quot;font-family:Helvetica;letter-spacing:0.3px;&quot;&gt;"
            f"&lt;b style=&quot;font-size:13px;&quot;&gt;{mname}&lt;/b&gt;&lt;br/&gt;"
            f"&lt;span style=&quot;font-size:9px;font-weight:normal;opacity:0.85;&quot;&gt;{domain_esc}&lt;/span&gt;"
            f"&lt;/div&gt;"
        )
        swimlane_style = (
            f"swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize={HEADER_HEIGHT};"
            f"horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;"
            f"align=center;fontSize=12;fontFamily=Helvetica;whiteSpace=wrap;html=1;"
            f"fillColor={m['header_bg']};strokeColor={m['border_color']};fontColor={m['header_fg']};"
            f"strokeWidth=2;shadow=1;arcSize=4;"
        )
        xml.append(f'        <mxCell id="{table_id}" value="{header_val}" style="{swimlane_style}" vertex="1" parent="1">')
        xml.append(f'          <mxGeometry x="{m["x"]}" y="{m["y"]}" width="{m["w"]}" height="{total_height}" as="geometry" />')
        xml.append('        </mxCell>')

        # ── FIELD ROWS (3-COLUMN PROFESSIONAL FORMAT) ──
        for idx, (badge_type, fname, ftype, nullability, desc) in enumerate(m["fields"]):
            row_id = f"row_{mname}_{idx}"
            
            # Key Badge Styling
            if badge_type == "PK":
                badge_html = '&lt;span style=&quot;background-color:#ffe082;color:#b78103;padding:1px 4px;border-radius:2px;font-weight:bold;font-size:9px;&quot;&gt;PK&lt;/span&gt;'
                fname_html = f'&lt;b style=&quot;color:#0f172a;&quot;&gt;{fname}&lt;/b&gt;'
            elif badge_type == "FK":
                badge_html = '&lt;span style=&quot;background-color:#bbdefb;color:#1565c0;padding:1px 4px;border-radius:2px;font-weight:bold;font-size:9px;&quot;&gt;FK&lt;/span&gt;'
                fname_html = f'&lt;span style=&quot;color:#1e40af;font-weight:600;&quot;&gt;{fname}&lt;/span&gt;'
            elif badge_type == "UQ":
                badge_html = '&lt;span style=&quot;background-color:#c8e6c9;color:#2e7d32;padding:1px 4px;border-radius:2px;font-weight:bold;font-size:9px;&quot;&gt;UQ&lt;/span&gt;'
                fname_html = f'&lt;span style=&quot;color:#166534;font-weight:600;&quot;&gt;{fname}&lt;/span&gt;'
            else:
                badge_html = '&lt;span style=&quot;color:#94a3b8;font-size:9px;&quot;&gt;&amp;bull;&lt;/span&gt;'
                fname_html = f'&lt;span style=&quot;color:#334155;&quot;&gt;{fname}&lt;/span&gt;'

            null_badge = (
                '&lt;span style=&quot;color:#dc2626;font-size:9px;&quot;&gt;NOT NULL&lt;/span&gt;'
                if nullability == "NOT NULL"
                else '&lt;span style=&quot;color:#94a3b8;font-size:9px;&quot;&gt;NULL&lt;/span&gt;'
            )

            # Table row HTML with precise columns
            row_html = (
                f'&lt;table width=&quot;100%&quot; cellpadding=&quot;0&quot; cellspacing=&quot;0&quot; style=&quot;font-family:Helvetica;font-size:10.5px;&quot;&gt;'
                f'&lt;tr&gt;'
                f'&lt;td width=&quot;26&quot; align=&quot;center&quot;&gt;{badge_html}&lt;/td&gt;'
                f'&lt;td align=&quot;left&quot; style=&quot;padding-left:4px;&quot;&gt;{fname_html}&lt;/td&gt;'
                f'&lt;td align=&quot;right&quot; style=&quot;color:#64748b;font-size:9.5px;&quot;&gt;{html.escape(ftype)} &amp;bull; {null_badge}&lt;/td&gt;'
                f'&lt;/tr&gt;'
                f'&lt;/table&gt;'
            )

            # Alternate row background
            bg_color = "#ffffff" if idx % 2 == 0 else "#f8fafc"
            row_style = (
                f"text;strokeColor=none;fillColor={bg_color};align=left;verticalAlign=middle;"
                f"spacingLeft=6;spacingRight=6;overflow=hidden;points=[[0,0.5],[1,0.5]];"
                f"portConstraint=eastwest;rotatable=0;whiteSpace=wrap;html=1;fontSize=10.5;fontFamily=Helvetica;"
            )
            xml.append(f'        <mxCell id="{row_id}" value="{row_html}" style="{row_style}" vertex="1" parent="{table_id}">')
            xml.append(f'          <mxGeometry y="{HEADER_HEIGHT + idx * ROW_HEIGHT}" width="{m["w"]}" height="{ROW_HEIGHT}" as="geometry" />')
            xml.append('        </mxCell>')

        # ── TABLE FOOTER (INDEXES & CONSTRAINTS) ──
        if has_constraints:
            footer_id = f"footer_{mname}"
            constraints_text = " &amp;bull; ".join([html.escape(c) for c in m["constraints"]])
            footer_html = (
                f'&lt;div style=&quot;font-family:Helvetica;font-size:9px;color:#64748b;overflow:hidden;text-overflow:ellipsis;&quot;&gt;'
                f'&lt;b style=&quot;color:#475569;&quot;&gt;INDEXES:&lt;/b&gt; {constraints_text}'
                f'&lt;/div&gt;'
            )
            footer_style = (
                "text;strokeColor=none;fillColor=#f1f5f9;align=left;verticalAlign=middle;"
                "spacingLeft=8;spacingRight=8;overflow=hidden;whiteSpace=wrap;html=1;fontSize=9;fontFamily=Helvetica;"
            )
            xml.append(f'        <mxCell id="{footer_id}" value="{footer_html}" style="{footer_style}" vertex="1" parent="{table_id}">')
            xml.append(f'          <mxGeometry y="{HEADER_HEIGHT + num_fields * ROW_HEIGHT}" width="{m["w"]}" height="{FOOTER_HEIGHT}" as="geometry" />')
            xml.append('        </mxCell>')

    # ── RELATIONAL CONNECTORS (ORTHOGONAL CROW\'S FOOT ARROWS) ──
    for rel_idx, (src, dst, card_src, card_dst, label, edge_color) in enumerate(relationships):
        edge_id = f"edge_{src}_{dst}_{rel_idx}"
        src_id = table_cell_map[src]
        dst_id = table_cell_map[dst]
        
        # Professional Cardinality badge
        edge_badge = (
            f"&lt;div style=&quot;font-family:Helvetica;font-size:9px;font-weight:bold;background-color:#ffffff;"
            f"padding:2px 5px;border-radius:4px;border:1px solid {edge_color};color:{edge_color};box-shadow:0 1px 2px rgba(0,0,0,0.05);&quot;&gt;"
            f"{card_src} &amp;rarr; {card_dst} ({label})&lt;/div&gt;"
        )
        edge_style = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
            f"endArrow=ERmany;startArrow=ERone;strokeColor={edge_color};strokeWidth=1.75;"
            f"fontSize=9.5;fontFamily=Helvetica;labelBackgroundColor=none;"
        )
        xml.append(f'        <mxCell id="{edge_id}" value="{edge_badge}" style="{edge_style}" edge="1" parent="1" source="{src_id}" target="{dst_id}">')
        xml.append('          <mxGeometry relative="1" as="geometry" />')
        xml.append('        </mxCell>')

    xml.append('      </root>')
    xml.append('    </mxGraphModel>')
    xml.append('  </diagram>')
    xml.append('</mxfile>')

    return "\n".join(xml)

if __name__ == "__main__":
    content = generate_pro_erd()
    target_backend = os.path.abspath("citydeals-backend/citydeals-erd.drawio")
    target_root = os.path.abspath("citydeals-erd.drawio")
    
    with open(target_backend, "w", encoding="utf-8") as f:
        f.write(content)
    with open(target_root, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("Enterprise Professional ERD generated successfully!")
    print(f"- {target_backend}")
    print(f"- {target_root}")
