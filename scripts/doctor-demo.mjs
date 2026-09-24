import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];

function record(name, ok, details = '') {
  checks.push({ name, ok, details });
}

function fail(message) {
  throw new Error(message);
}

function loadEnvFile() {
  const envPath = resolve(root, '.env');
  record('.env file', existsSync(envPath), existsSync(envPath) ? 'found' : 'missing, run npm run demo:setup');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (process.env[key]) continue;
    process.env[key] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

function requireEnv(key, options = {}) {
  const value = process.env[key] || '';
  const ok = options.allowEmpty ? key in process.env : Boolean(value);
  record(`env ${key}`, ok, ok ? (value ? 'set' : 'empty allowed') : 'missing');
  return value;
}

async function main() {
  loadEnvFile();

  record('node_modules', existsSync(resolve(root, 'node_modules')), existsSync(resolve(root, 'node_modules')) ? 'found' : 'missing, run npm install');
  record('Prisma schema', existsSync(resolve(root, 'prisma/schema.prisma')), 'prisma/schema.prisma');

  const databaseUrl = requireEnv('DATABASE_URL');
  requireEnv('JWT_SECRET');
  requireEnv('NEXT_PUBLIC_APP_URL');
  requireEnv('DEMO_MODE', { allowEmpty: true });
  requireEnv('PAYMENT_SANDBOX_MODE', { allowEmpty: true });

  if (databaseUrl.startsWith('file:')) {
    const sqlitePath = databaseUrl.replace(/^file:/, '');
    const dbPath = resolve(root, 'prisma', sqlitePath);
    record('SQLite database file', existsSync(dbPath), dbPath);
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    record('Database connection', true, 'connected');

    const [users, courses, settings, categories] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.setting.count(),
      prisma.category.count()
    ]);
    record('Users table', users >= 3, `${users} users`);
    record('Courses table', courses > 0, `${courses} courses`);
    record('Categories table', categories > 0, `${categories} categories`);
    record('Settings table', settings > 0, `${settings} settings`);

    const demoUsers = await prisma.user.findMany({
      where: { email: { in: ['admin@demo.com', 'instructor@demo.com', 'student@demo.com'] } },
      select: { email: true, role: true, status: true }
    });
    const demoMap = new Map(demoUsers.map((user) => [user.email, user]));
    record('Demo admin', demoMap.get('admin@demo.com')?.role === 'ADMIN', demoMap.get('admin@demo.com')?.status || 'missing');
    record('Demo instructor', demoMap.get('instructor@demo.com')?.role === 'INSTRUCTOR', demoMap.get('instructor@demo.com')?.status || 'missing');
    record('Demo student', demoMap.get('student@demo.com')?.role === 'STUDENT', demoMap.get('student@demo.com')?.status || 'missing');

    const publishedCourses = await prisma.course.count({ where: { status: 'PUBLISHED' } });
    record('Published courses', publishedCourses > 0, `${publishedCourses} published`);

    const theme = await prisma.setting.findUnique({ where: { key: 'theme' } });
    record('Theme settings', Boolean(theme), theme ? 'configured' : 'using defaults');
  } finally {
    await prisma.$disconnect();
  }

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? 'OK' : 'FAIL'} ${check.name}${check.details ? ` - ${check.details}` : ''}`);
  }

  if (failed.length) fail(`${failed.length} preflight check(s) failed`);
  console.log('Demo doctor passed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
