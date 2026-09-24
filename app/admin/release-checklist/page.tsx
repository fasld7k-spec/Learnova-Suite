import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { productionEnvReadiness, productionReadinessRows } from '@/lib/production-readiness';
import { getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

type LaunchCheck = {
  area: string;
  title: string;
  ready: boolean;
  evidence: string;
  nextStep: string;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function hasText(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function readinessBadge(ready: boolean) {
  return <Badge tone={ready ? 'green' : 'yellow'}>{ready ? 'Ready' : 'Review'}</Badge>;
}

export default async function ReleaseChecklist() {
  await requireUser(['ADMIN']);

  const [
    manualRows,
    settings,
    categories,
    activePaymentMethods,
    publishedCourses,
    pendingCourses,
    pendingInstructors,
    languages,
    seoOverrides,
    seoSetting,
    emailLogs,
    activeWebhookEndpoints,
  ] = await Promise.all([
    prisma.releaseChecklist.findMany({ orderBy: { sortOrder: 'asc' } }),
    getSiteSettings(),
    prisma.category.count(),
    prisma.paymentMethod.count({ where: { active: true } }),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.course.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { role: 'INSTRUCTOR', status: 'PENDING' } }),
    prisma.language.count().catch(() => 0),
    prisma.seoMetaOverride.count().catch(() => 0),
    prisma.setting.findUnique({ where: { key: 'seo' } }).catch(() => null),
    prisma.emailLog.count().catch(() => 0),
    prisma.webhookEndpoint.count({ where: { active: true } }).catch(() => 0),
  ]);

  const storageReady = settings.storageProvider === 'local'
    ? process.env.NODE_ENV !== 'production' || settings.allowLocalUploads
    : ['s3', 'r2'].includes(settings.storageProvider) && Boolean(settings.storageBucket && settings.storageAccessKeyId && settings.storageSecretAccessKey);
  const emailReady = settings.emailProvider === 'log' || Boolean(settings.smtpSender && settings.smtpHost);
  const aiReady = !settings.aiEnabled || settings.aiProvider === 'demo' || Boolean(settings.aiApiKey);
  const generalReady = Boolean(settings.siteName && settings.supportEmail && settings.officialEmail);
  const configuredSocialProviders = [
    settings.googleClientId && settings.googleClientSecret ? 'Google' : '',
    settings.githubClientId && settings.githubClientSecret ? 'GitHub' : '',
    settings.facebookClientId && settings.facebookClientSecret ? 'Facebook' : '',
  ].filter(Boolean);
  const socialAuthReady = configuredSocialProviders.length > 0;
  const seoReady = Boolean(seoSetting || seoOverrides > 0);
  const env = productionEnvReadiness();
  const productionRows = productionReadinessRows();

  const automaticChecks: LaunchCheck[] = [
    ...productionRows.map((row) => ({
      area: 'Production env',
      title: row.label,
      ready: row.ready,
      evidence: row.detail,
      nextStep: row.nextStep,
    })),
    {
      area: 'Environment',
      title: 'Production mode switches',
      ready: env.productionSwitchesReady,
      evidence: env.productionRuntime
        ? `DEMO_MODE=${env.demoMode} / PAYMENT_SANDBOX_MODE=${env.sandboxPayments} / ALLOW_PRODUCTION_DEMO_PAYMENTS=${env.productionDemoPayments}`
        : 'Local/demo runtime',
      nextStep: 'Before live launch, set DEMO_MODE=false, PAYMENT_SANDBOX_MODE=false, and ALLOW_PRODUCTION_DEMO_PAYMENTS=false.',
    },
    {
      area: 'Environment',
      title: 'Application secret',
      ready: env.jwtReady,
      evidence: env.jwtReady ? 'JWT secret is present and acceptable for this runtime.' : 'JWT secret is missing, short, or still a demo placeholder.',
      nextStep: 'Set JWT_SECRET to a long random production value.',
    },
    {
      area: 'Security',
      title: 'Encrypted admin secrets',
      ready: env.settingsEncryptionReady,
      evidence: env.settingsEncryptionReady ? 'Settings encryption key ready.' : 'SETTINGS_ENCRYPTION_KEY missing or placeholder in production.',
      nextStep: 'Set SETTINGS_ENCRYPTION_KEY before saving live provider/API secrets.',
    },
    {
      area: 'Security',
      title: 'Protected media signing',
      ready: env.contentProtectionReady,
      evidence: env.contentProtectionReady ? 'Content protection secret ready.' : 'CONTENT_PROTECTION_SECRET missing or placeholder in production.',
      nextStep: 'Set CONTENT_PROTECTION_SECRET to a long random value before live protected lessons.',
    },
    {
      area: 'Security',
      title: 'Protected media host allowlist',
      ready: env.mediaHostAllowlistReady,
      evidence: env.mediaAllowedHosts || (env.productionRuntime ? 'No MEDIA_ALLOWED_HOSTS configured' : 'Local/demo runtime'),
      nextStep: 'Set MEDIA_ALLOWED_HOSTS to your CDN/video provider hostnames for production.',
    },
    {
      area: 'Settings',
      title: 'General contact settings',
      ready: generalReady,
      evidence: `${settings.siteName || 'No site name'} / ${settings.supportEmail || 'No support email'}`,
      nextStep: 'Complete site name, support email, and official email in General Settings.',
    },
    {
      area: 'Settings',
      title: 'Languages and currency',
      ready: Boolean(settings.defaultLanguage && settings.currency && languages > 0),
      evidence: `${settings.defaultLanguage.toUpperCase()} / ${settings.currency} / ${plural(languages, 'language')}`,
      nextStep: 'Add or activate at least one language and confirm the storefront currency.',
    },
    {
      area: 'Content',
      title: 'Course catalog',
      ready: categories > 0 && publishedCourses > 0,
      evidence: `${plural(categories, 'category', 'categories')} / ${plural(publishedCourses, 'published course')}`,
      nextStep: 'Create categories and publish at least one course for buyers to browse.',
    },
    {
      area: 'Content',
      title: 'Admin review queue',
      ready: pendingCourses === 0 && pendingInstructors === 0,
      evidence: `${plural(pendingCourses, 'pending course')} / ${plural(pendingInstructors, 'pending instructor')}`,
      nextStep: 'Approve or reject pending courses and instructor applications.',
    },
    {
      area: 'Payments',
      title: 'Checkout methods',
      ready: activePaymentMethods > 0,
      evidence: plural(activePaymentMethods, 'active method'),
      nextStep: 'Enable at least one payment gateway or offline payment method.',
    },
    {
      area: 'Payments',
      title: 'Webhook endpoints',
      ready: activeWebhookEndpoints > 0 || activePaymentMethods === 0,
      evidence: activePaymentMethods === 0 ? 'No active checkout method yet' : plural(activeWebhookEndpoints, 'active endpoint'),
      nextStep: 'Add an active webhook endpoint for live payment and integration events.',
    },
    {
      area: 'Email',
      title: 'Transactional email',
      ready: emailReady,
      evidence: `${settings.emailProvider} provider / ${emailLogs} logged messages`,
      nextStep: 'Configure SMTP sender and host, or confirm the log provider is intentional.',
    },
    {
      area: 'Storage',
      title: 'Upload storage',
      ready: storageReady,
      evidence: `${settings.storageProvider} provider${settings.storageBucket ? ` / ${settings.storageBucket}` : ''}`,
      nextStep: 'Configure S3/R2 credentials or explicitly allow local uploads for production.',
    },
    {
      area: 'SEO',
      title: 'Search metadata',
      ready: seoReady,
      evidence: seoSetting ? `Default SEO saved / ${plural(seoOverrides, 'override')}` : plural(seoOverrides, 'override'),
      nextStep: 'Save default SEO metadata or add route-specific meta overrides.',
    },
    {
      area: 'AI',
      title: 'AI assistant',
      ready: aiReady,
      evidence: settings.aiEnabled ? `${settings.aiProvider} / ${hasText(settings.aiApiKey) ? 'API key saved' : 'API key missing'}` : 'Disabled',
      nextStep: 'Disable AI for launch, use demo mode, or save a provider API key.',
    },
    {
      area: 'Auth',
      title: 'Social sign-in',
      ready: socialAuthReady,
      evidence: socialAuthReady ? `${configuredSocialProviders.join(', ')} OAuth credentials saved` : 'No OAuth provider credentials saved',
      nextStep: 'Add Google, GitHub, or Facebook OAuth credentials, or leave social sign-in as an intentional manual launch exception.',
    },
  ];

  const automaticRemaining = automaticChecks.filter((check) => !check.ready).length;
  const manualRemaining = manualRows.filter((row) => !row.done).length;
  const totalRemaining = automaticRemaining + manualRemaining;

  return (
    <DashboardShell role="admin" title="Release Checklist">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Remaining Checks" value={totalRemaining} />
        <StatCard label="Automatic Review" value={`${automaticChecks.length - automaticRemaining}/${automaticChecks.length}`} />
        <StatCard label="Manual Pending" value={manualRemaining} />
        <StatCard label="Launch Status" value={totalRemaining === 0 ? 'Ready' : 'Review'} />
      </div>

      <div className="mb-6">
        <DataTable
          headers={['Area', 'Launch Check', 'Status', 'Evidence', 'Next Step']}
          rows={automaticChecks.map((check) => [
            check.area,
            check.title,
            readinessBadge(check.ready),
            check.evidence,
            check.ready ? 'No action needed.' : check.nextStep,
          ])}
        />
      </div>

      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/admin/release-checklist" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Checklist item" />
        <input className="input" name="sortOrder" type="number" defaultValue={0} />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="done" /> Done
        </label>
        <button className="btn-primary">Add Item</button>
      </form>

      <DataTable
        headers={['Manual Sign-off', 'Done', 'Sort', 'Manage']}
        rows={manualRows.map((row) => [
          row.title,
          <Badge key="d" tone={row.done ? 'green' : 'yellow'}>{row.done ? 'Done' : 'Pending'}</Badge>,
          row.sortOrder,
          <div key="manage" className="grid min-w-72 gap-2">
            <form className="grid gap-2" action="/api/admin/release-checklist" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={row.id} />
              <input className="input" name="title" defaultValue={row.title} />
              <input className="input" name="sortOrder" type="number" defaultValue={row.sortOrder} />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input type="checkbox" name="done" defaultChecked={row.done} /> Done
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/release-checklist" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary">{row.done ? 'Mark Pending' : 'Mark Done'}</button>
              </form>
              <form action="/api/admin/release-checklist" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
