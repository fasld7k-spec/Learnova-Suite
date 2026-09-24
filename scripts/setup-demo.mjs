import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
  return result.stdout;
}

function npm(args) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    console.error('npm_execpath is missing. Run this script through npm: npm run demo:setup');
    process.exit(1);
  }
  run(process.execPath, [npmCli, ...args]);
}

function npmCapture(args) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error('npm_execpath is missing. Run this script through npm: npm run demo:setup');
  }
  return capture(process.execPath, [npmCli, ...args]);
}

async function settingTableExists() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM "Setting" LIMIT 1');
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function applyFreshSqliteSchema() {
  console.log('Applying fresh SQLite schema fallback...');
  const sql = npmCapture([
    'exec',
    '--yes',
    '--',
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ]);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  try {
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (!existsSync('.env')) {
  copyFileSync('.env.demo.example', '.env');
  console.log('Created .env from .env.demo.example');
} else {
  console.log('.env already exists. Keeping your current values.');
}

console.log('Generating Prisma client...');
npm(['exec', '--yes', '--', 'prisma', 'generate', '--schema=prisma/schema.prisma']);

console.log('Preparing SQLite demo database...');
if (!(await settingTableExists())) {
  await applyFreshSqliteSchema();
}

if (!(await settingTableExists())) {
  console.error('Demo database setup failed: Setting table was not created.');
  process.exit(1);
}

console.log('Seeding demo data...');
npm(['run', 'prisma:seed']);

console.log('\nDemo is ready.');
console.log('Run: npm run demo:dev');
console.log('Accounts: admin@demo.com / instructor@demo.com / student@demo.com');
console.log(`Password: ${process.env.DEMO_PASSWORD || 'value of DEMO_PASSWORD'}`);
