import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const productName = 'Learnova Suite';
const tagline = 'Live learning marketplace for courses, cohorts and instructor-led education.';

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parseJson(parsed) : parsed;
  } catch {
    return value;
  }
}

function fromJsonObject(value) {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function isPostgresDatabase() {
  return /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '');
}

function toJson(value) {
  return isPostgresDatabase() ? value : JSON.stringify(value);
}

async function upsertSetting(key, patch) {
  const row = await prisma.setting.findUnique({ where: { key } });
  const current = fromJsonObject(row?.value);
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key },
    update: { value: toJson(next) },
    create: { key, value: toJson(next) },
  });
  return next;
}

async function main() {
  await upsertSetting('general', {
    siteName: productName,
    certificateIssuer: productName,
    tagline,
    defaultLanguage: 'en',
    currency: 'USD',
    theme: 'dark',
  });

  await upsertSetting('white_label', {
    brandName: productName,
  });

  await upsertSetting('seo', {
    defaultTitle: productName,
    defaultDescription: 'A live learning marketplace SaaS for course sales, cohorts, certificates and role-based dashboards.',
  });

  const about = await prisma.page.findUnique({ where: { slug: 'about' } }).catch(() => null);
  if (about) {
    await prisma.page.update({
      where: { slug: 'about' },
      data: {
        titleEn: `About ${productName}`,
        bodyEn: `${productName} is a production-oriented education marketplace.`,
        seoTitle: `About ${productName}`,
        seoDescription: 'Learn about the live learning marketplace platform.',
      },
    });
  }

  const general = await prisma.setting.findUnique({ where: { key: 'general' } });
  const whiteLabel = await prisma.setting.findUnique({ where: { key: 'white_label' } });
  const seo = await prisma.setting.findUnique({ where: { key: 'seo' } });

  console.log('Hosted demo identity prepared.');
  console.log(JSON.stringify({
    general: fromJsonObject(general?.value),
    whiteLabel: fromJsonObject(whiteLabel?.value),
    seo: fromJsonObject(seo?.value),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
