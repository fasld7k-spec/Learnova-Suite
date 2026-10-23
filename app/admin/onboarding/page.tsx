import Link from 'next/link';
import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { getCsrfToken } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

const steps = [
  ['General settings', '/admin/settings'],
  ['AI assistant settings', '/admin/settings'],
  ['Categories', '/admin/categories'],
  ['Payment gateways', '/admin/payment-gateways'],
  ['Languages and currencies', '/admin/languages'],
  ['Published courses', '/admin/courses'],
  ['SEO metadata', '/admin/seo-meta'],
  ['Storage check', '/admin/upload-test'],
  ['Email settings', '/admin/settings'],
  ['Email logs', '/admin/email-logs'],
  ['Release checklist', '/admin/release-checklist']
];

export default async function Onboarding({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const [categories, gateways, courses, seoRows, emailLogs, settings, manualRows] = await Promise.all([
    prisma.category.count(),
    prisma.paymentMethod.count({ where: { active: true } }),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.seoMetaOverride.count().catch(() => 0),
    prisma.emailLog.count().catch(() => 0),
    getSiteSettings(),
    prisma.releaseChecklist.findMany({ orderBy: { sortOrder: 'asc' } })
  ]);
  const storageReady = settings.storageProvider === 'local'
    ? process.env.NODE_ENV !== 'production' || settings.allowLocalUploads
    : ['s3', 'r2'].includes(settings.storageProvider) && Boolean(settings.storageBucket && settings.storageAccessKeyId && settings.storageSecretAccessKey);
  const emailReady = settings.emailProvider === 'log' || Boolean(settings.smtpHost && settings.smtpSender);
  const aiReady = !settings.aiEnabled || settings.aiProvider === 'demo' || Boolean(settings.aiApiKey);
  const generalReady = Boolean(settings.siteName && settings.supportEmail && settings.officialEmail);
  const localizationReady = Boolean(settings.defaultLanguage && settings.currency);

  const done = new Set<string>();
  if (categories) done.add('Categories');
  if (gateways) done.add('Payment gateways');
  if (courses) done.add('Published courses');
  if (seoRows) done.add('SEO metadata');
  if (emailReady) done.add('Email settings');
  if (emailLogs) done.add('Email logs');
  if (storageReady) done.add('Storage check');
  if (aiReady) done.add('AI assistant settings');
  if (generalReady) done.add('General settings');
  if (localizationReady) done.add('Languages and currencies');
  const automaticDone = steps.filter(([title]) => done.has(title)).length;
  const manualDone = manualRows.filter((row) => row.done).length;
  const totalSteps = steps.length + manualRows.length;
  const completedSteps = automaticDone + manualDone;
  const completion = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <DashboardShell role="admin" title="Setup Wizard">
      {params?.seeded && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-black text-emerald-200">
          Default launch sign-offs are ready in the checklist.
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Setup Completion" value={`${completion}%`} />
        <StatCard label="Automatic Checks" value={`${automaticDone}/${steps.length}`} />
        <StatCard label="Manual Sign-offs" value={`${manualDone}/${manualRows.length}`} />
        <StatCard label="Launch State" value={completion === 100 ? 'Ready' : 'Review'} />
      </div>

      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#71767B]">Launch workflow</p>
            <h2 className="mt-2 text-2xl font-black text-white">Setup control</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
              Automatic checks read real platform configuration. Manual sign-offs let the owner confirm review-only tasks such as legal pages, demo credentials, and package readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action="/api/admin/onboarding" method="post">
          <CsrfInput />
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="_action" value="seed-launch-signoffs" />
              <button className="btn-secondary">Add default launch sign-offs</button>
            </form>
            <Link className="btn-primary" href="/admin/release-checklist">Full release checklist</Link>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#16181C]">
          <div className="h-full rounded-full bg-[#1D9BF0]" style={{ width: `${completion}%` }} />
        </div>
      </section>

      <div className="mb-6 grid gap-3">
        {steps.map(([title, href], index) => {
          const completed = done.has(title);
          return (
            <a className="card flex items-center justify-between gap-4" href={href} key={title}>
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-[#2F3336] text-sm font-bold text-[#1D9BF0]">{index + 1}</div>
                <div>
                  <h2 className="font-bold text-white">{title}</h2>
                  <p className="text-sm text-[#71767B]">Open this module and confirm it is ready for launch.</p>
                </div>
              </div>
              <Badge tone={completed ? 'green' : 'yellow'}>{completed ? 'Ready' : 'Review'}</Badge>
            </a>
          );
        })}
      </div>

      <DataTable
        headers={['Manual Sign-off', 'Status', 'Sort', 'Manage']}
        rows={manualRows.map((row) => [
          row.title,
          <Badge key="status" tone={row.done ? 'green' : 'yellow'}>{row.done ? 'Done' : 'Pending'}</Badge>,
          row.sortOrder,
          <div key="manage" className="flex min-w-56 flex-wrap gap-2">
            <form action="/api/admin/release-checklist" method="post">
          <CsrfInput />
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="_action" value="toggle" />
              <input type="hidden" name="id" value={row.id} />
              <button className="btn-secondary text-xs">{row.done ? 'Mark pending' : 'Mark done'}</button>
            </form>
            <Link className="btn-secondary text-xs" href="/admin/release-checklist">Edit</Link>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
