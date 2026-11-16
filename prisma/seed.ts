import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not defined in environment variables');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@citydeals.test';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || '12345678';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  console.log(`Seeding admin user (${adminEmail})...`);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      onboardingCompleted: true,
      acceptedTerms: true,
    },
    create: {
      fullName: 'Super Administrator',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      acceptedTerms: true,
      onboardingCompleted: true,
    },
  });

  // Seed Reviewer / Test User (Normal USER role)
  const reviewerEmail = process.env.SEED_REVIEWER_EMAIL || 'reviewer@citydeals.com';
  const reviewerPassword = process.env.SEED_REVIEWER_PASSWORD || 'CityDeals@1234';
  const reviewerPasswordHash = await bcrypt.hash(reviewerPassword, 12);

  console.log(`Seeding reviewer test user (${reviewerEmail})...`);

  const reviewer = await prisma.user.upsert({
    where: { email: reviewerEmail },
    update: {
      role: 'USER',
      status: 'ACTIVE',
      passwordHash: reviewerPasswordHash,
      onboardingCompleted: true,
      acceptedTerms: true,
    },
    create: {
      fullName: 'Google Reviewer',
      email: reviewerEmail,
      passwordHash: reviewerPasswordHash,
      role: 'USER',
      status: 'ACTIVE',
      acceptedTerms: true,
      onboardingCompleted: true,
    },
  });

  console.log('Seed completed successfully!');
  console.log('--------------------------------------------------');
  console.log(`Admin User:    ${admin.email} / ${adminPassword} (ADMIN)`);
  console.log(`Reviewer User: ${reviewer.email} / ${reviewerPassword} (USER)`);
  console.log('--------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
