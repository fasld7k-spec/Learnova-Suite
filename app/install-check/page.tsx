export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Terminal } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { productionEnvReadiness, productionReadinessRows } from '@/lib/production-readiness';
import { getSiteSettings } from '@/lib/site-settings';

type CheckTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
type LaunchCheck = { label: string; status: string; tone: CheckTone; detail: string };
type InstallationStep = { number: string; title: string; status: string; tone: CheckTone; detail: string };

function envSet(key: string) {
  return Boolean(process.env[key]);
}

function check(label: string, ok: boolean, detail: string, warn = false): LaunchCheck {
  return { label, status: ok ? (warn ? 'Review' : 'Ready') : 'Missing', tone: ok ? (warn ? 'yellow' : 'green') : 'red', detail };
}

async function databaseChecks(): Promise<LaunchCheck[]> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [users, courses, publishedCourses, categories, settings, demoUsers] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.course.count({ where: { status: 'PUBLISHED' } }),
      prisma.category.count(),
      prisma.setting.count(),
      prisma.user.findMany({
        where: { email: { in: ['admin@demo.com', 'instructor@demo.com', 'student@demo.com'] } },
        select: { email: true, role: true, status: true }
      })
    ]);
    const demoMap = new Map(demoUsers.map((user) => [user.email, user]));

    return [
      check('Database connection', true, 'Prisma can connect to the configured database.'),
      check('Users seeded', users >= 3, `${users} users found.`),
      check('Categories seeded', categories > 0, `${categories} categories found.`),
      check('Courses seeded', courses > 0, `${courses} courses found.`),
      check('Published catalog', publishedCourses > 0, `${publishedCourses} published courses found.`),
      check('Settings seeded', settings > 0, `${settings} settings rows found.`),
      check('Demo admin', demoMap.get('admin@demo.com')?.role === 'ADMIN', demoMap.get('admin@demo.com')?.status || 'Missing.'),
      check('Demo instructor', demoMap.get('instructor@demo.com')?.role === 'INSTRUCTOR', demoMap.get('instructor@demo.com')?.status || 'Missing.'),
      check('Demo student', demoMap.get('student@demo.com')?.role === 'STUDENT', demoMap.get('student@demo.com')?.status || 'Missing.')
    ];
  } catch (error) {
    return [
      {
        label: 'Database connection',
        status: 'Failed',
        tone: 'red',
        detail: error instanceof Error ? error.message : 'Database is not reachable.'
      }
    ];
  }
}

async function environmentChecks(): Promise<LaunchCheck[]> {
  const settings = await getSiteSettings();
  const env = productionEnvReadiness();
  const localUploads = settings.storageProvider === 'local' && (process.env.NODE_ENV !== 'production' || settings.allowLocalUploads);
  const remoteUploads = ['s3', 'r2'].includes(settings.storageProvider) && Boolean(settings.storageBucket && settings.storageAccessKeyId && settings.storageSecretAccessKey);
  const smtpReady = Boolean(settings.smtpHost);
  const aiReady = !settings.aiEnabled || settings.aiProvider === 'demo' || Boolean(settings.aiApiKey);
  const productionRows = productionReadinessRows();

  return [
    check('DATABASE_URL', envSet('DATABASE_URL'), 'Required for Prisma.'),
    check('JWT_SECRET', env.jwtReady, 'Use a long random secret and never ship demo/placeholder values.'),
    check('SETTINGS_ENCRYPTION_KEY', env.settingsEncryptionReady, env.productionRuntime ? 'Required in production for encrypted admin integration secrets.' : 'Optional in demo; add it before production.'),
    check('CONTENT_PROTECTION_SECRET', env.contentProtectionReady, env.productionRuntime ? 'Required in production for signed protected media links.' : 'Optional in demo; add it before production.'),
    check('Public site URL', true, settings.publicAppUrl ? 'Configured from admin settings.' : 'Optional: the app can auto-detect the current domain; set a URL for stable callbacks behind proxies.', !(settings.publicAppUrl || process.env.NEXT_PUBLIC_APP_URL)),
    check('Demo mode', env.demoMode, env.demoMode ? 'Correct for a local demo.' : 'Turn on only for demo installs.', !env.demoMode),
    check('Payment sandbox', env.sandboxPayments, env.sandboxPayments ? 'Safe for demo checkout.' : 'Production/live payment mode.', !env.sandboxPayments),
    check('Production live switches', env.productionSwitchesReady, env.productionRuntime ? 'Production must run with DEMO_MODE=false, PAYMENT_SANDBOX_MODE=false, and ALLOW_PRODUCTION_DEMO_PAYMENTS=false.' : 'Local demo runtime detected.', !env.productionRuntime),
    check('PostgreSQL production database', env.postgresReady, env.productionRuntime ? 'DATABASE_URL must use PostgreSQL in production.' : 'Local demo database is allowed.', !env.productionRuntime),
    check('2FA encryption key', env.totpEncryptionReady, env.productionRuntime ? 'TOTP_ENCRYPTION_KEY is required before production 2FA.' : 'Optional in demo; add it before production.'),
    check('Embed frame policy', env.embedFrameAncestorsReady, env.embedFrameAncestorsReady ? 'Frame ancestors are restricted.' : 'Set EMBED_FRAME_ANCESTORS to specific trusted origins.', !env.embedFrameAncestorsReady),
    check('Production mock payment guard', !env.productionRuntime || !env.productionDemoPayments, env.productionDemoPayments ? 'Mock payment confirmation is explicitly enabled for a hosted demo.' : 'Mock payment confirmation is blocked in production.', env.productionDemoPayments),
    check('Upload storage', settings.storageProvider === 'local' ? localUploads : remoteUploads, settings.storageProvider === 'local' ? 'Local demo storage selected.' : `${settings.storageProvider.toUpperCase()} storage settings saved.`, settings.storageProvider === 'local'),
    check('SMTP', smtpReady, smtpReady ? 'SMTP settings are configured in admin or environment.' : 'Demo can run without SMTP; configure before live email delivery.', !smtpReady),
    check('AI tools', aiReady, aiReady ? 'AI tools are ready or using demo generation.' : 'Add an AI API key from admin settings.', !settings.aiEnabled || settings.aiProvider === 'demo'),
    ...productionRows
      .filter((row) => !['NODE_ENV=production', 'Strong JWT secret', 'Settings encryption', 'Content protection secret', 'Live mode switches', 'PostgreSQL database', 'Embed frame ancestors', 'Transactional email', 'Remote storage', 'Media host allowlist'].includes(row.label))
      .map((row) => check(row.label, row.ready, row.detail, !row.ready)),
  ];
}

function StatusIcon({ tone }: { tone: CheckTone }) {
  if (tone === 'red' || tone === 'yellow') return <AlertTriangle size={18} className={tone === 'red' ? 'text-rose-300' : 'text-amber-300'} />;
  return <CheckCircle2 size={18} className="text-emerald-300" />;
}

function CheckList({ title, items }: { title: string; items: LaunchCheck[] }) {
  return (
    <section className="moe-panel overflow-hidden">
      <div className="border-b border-violet-300/15 p-5">
        <h2 className="text-xl font-black text-white">{title}</h2>
      </div>
      <div className="divide-y divide-violet-300/15">
        {items.map((item) => (
          <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto]" key={item.label}>
            <div className="flex gap-3">
              <StatusIcon tone={item.tone} />
              <div>
                <p className="font-black text-white">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{item.detail}</p>
              </div>
            </div>
            <Badge tone={item.tone}>{item.status}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function WizardSteps({ steps }: { steps: InstallationStep[] }) {
  return (
    <section className="moe-panel overflow-hidden">
      <div className="border-b border-violet-300/15 p-5">
        <p className="text-sm font-bold text-violet-200">Setup wizard</p>
        <h2 className="mt-1 text-2xl font-black text-white">Install in five clear steps</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          This wizard mirrors the README flow so you can verify your hosting setup without reading code or exposing secrets.
        </p>
      </div>
      <div className="grid divide-y divide-violet-300/15 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        {steps.map((step) => (
          <div className="p-5" key={step.number}>
            <div className="flex items-center justify-between gap-3">
              <span className="moe-mini-icon h-10 w-10 text-sm font-black">{step.number}</span>
              <Badge tone={step.tone}>{step.status}</Badge>
            </div>
            <h3 className="mt-4 text-base font-black text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function InstallCheck() {
  const dbChecks = await databaseChecks();
  const envChecks = await environmentChecks();
  const failed = [...dbChecks, ...envChecks].filter((item) => item.tone === 'red').length;
  const warnings = [...dbChecks, ...envChecks].filter((item) => item.tone === 'yellow').length;
  const dbReady = dbChecks.every((item) => item.tone !== 'red');
  const envReady = envChecks.filter((item) => ['DATABASE_URL', 'JWT_SECRET'].includes(item.label)).every((item) => item.tone !== 'red');
  const demoReady = dbChecks.filter((item) => item.label.startsWith('Demo ')).every((item) => item.tone !== 'red');
  const steps: InstallationStep[] = [
    {
      number: '01',
      title: 'Install dependencies',
      status: 'Documented',
      tone: 'blue',
      detail: 'Run npm install, copy .env.example to .env, then configure the required values.'
    },
    {
      number: '02',
      title: 'Configure environment',
      status: envReady ? 'Ready' : 'Review',
      tone: envReady ? 'green' : 'red',
      detail: 'DATABASE_URL and JWT_SECRET are required. The public domain can be auto-detected or configured from admin settings.'
    },
    {
      number: '03',
      title: 'Prepare database',
      status: dbReady ? 'Ready' : 'Review',
      tone: dbReady ? 'green' : 'red',
      detail: 'Run Prisma migrations and seed demo data so you can test admin, instructor, and student flows.'
    },
    {
      number: '04',
      title: 'Verify demo accounts',
      status: demoReady ? 'Ready' : 'Review',
      tone: demoReady ? 'green' : 'red',
      detail: 'The packaged demo should include approved admin, instructor, and student users with documented credentials.'
    },
    {
      number: '05',
      title: 'Run final checks',
      status: failed ? 'Blocked' : warnings ? 'Demo ready' : 'Ready',
      tone: failed ? 'red' : warnings ? 'yellow' : 'green',
      detail: 'Use demo:doctor, release:check, demo:dev, and demo:smoke before moving to production setup.'
    }
  ];

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
          <Badge tone={failed ? 'red' : warnings ? 'yellow' : 'green'}>{failed ? 'Action needed' : warnings ? 'Demo ready' : 'Ready'}</Badge>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">Installation and launch readiness</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            This page checks the local demo setup without showing secret values. Use it with the CLI doctor and smoke tests before review, demos, or deployment handoff.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="moe-primary" href="/admin/settings">
              Admin settings
            </Link>
            <Link className="moe-control px-4" href="/admin/theme">
              Theme customizer
            </Link>
            <Link className="moe-control px-4" href="/help">
              Help center
            </Link>
          </div>
          </div>
        </section>

        <div className="page-shell mt-8 grid gap-6">
          <WizardSteps steps={steps} />
          <CheckList title="Environment" items={envChecks} />
          <CheckList title="Database and demo data" items={dbChecks} />

          <section className="moe-panel p-5">
            <div className="flex items-center gap-3">
              <Terminal className="text-violet-200" size={22} />
              <h2 className="text-xl font-black text-white">Recommended final commands</h2>
            </div>
            <pre className="mt-5 overflow-auto rounded-md border border-violet-300/15 bg-black/25 p-4 text-sm leading-7 text-white">{`npm run demo:doctor
npm run lint
npx tsc --noEmit
npm run demo:build
npm run demo:dev
npm run demo:smoke`}</pre>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
