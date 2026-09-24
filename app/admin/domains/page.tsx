import { Badge } from '@/components/dashboard/Badge';
import { CopyLink } from '@/components/dashboard/CopyLink';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { currentAppUrl } from '@/lib/request-url';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { CheckCircle2, Globe2, Link2, ShieldCheck } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';

function callbackRows(appUrl: string) {
  return [
    ['Sitemap', `${appUrl}/sitemap.xml`],
    ['Robots', `${appUrl}/robots.txt`],
    ['Stripe webhook', `${appUrl}/api/webhooks/stripe`],
    ['PayPal webhook', `${appUrl}/api/webhooks/paypal`],
    ['Generic gateway webhook', `${appUrl}/api/webhooks/{gateway}`],
    ['Google OAuth callback', `${appUrl}/api/auth/oauth/google/callback`],
    ['GitHub OAuth callback', `${appUrl}/api/auth/oauth/github/callback`],
    ['Facebook OAuth callback', `${appUrl}/api/auth/oauth/facebook/callback`],
    ['Certificate verify', `${appUrl}/certificates/verify`],
  ];
}

export default async function Domains(props: { searchParams?: Promise<{ verified?: string; publicUrl?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const [rows, settings] = await Promise.all([
    prisma.domainVerification.findMany({ orderBy: { createdAt: 'desc' } }),
    getSiteSettings(),
  ]);
  const appUrl = await currentAppUrl(settings.publicAppUrl);
  const detectedHost = new URL(appUrl).host;
  const configuredHost = settings.publicAppUrl ? new URL(settings.publicAppUrl).host : '';

  return (
    <DashboardShell role="admin" title="Domain Verification">
      {searchParams?.verified ? (
        <div className={`mb-6 border px-4 py-3 text-sm font-bold ${searchParams.verified === '1' ? 'border-[#00BA7C] text-[#00BA7C]' : 'border-[#FFD400] text-[#FFD400]'}`}>
          {searchParams.verified === '1'
            ? 'Domain TXT record verified successfully.'
            : 'TXT record was not found yet. DNS propagation can take a few minutes.'}
        </div>
      ) : null}
      {searchParams?.publicUrl ? (
        <div className="mb-6 border border-[#00BA7C] px-4 py-3 text-sm font-bold text-[#00BA7C]">
          Public site URL updated. SEO links, webhooks, certificates, and emails will now use the selected domain.
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <section className="border border-[#2F3336] bg-black p-5">
          <Globe2 className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-sm font-bold text-[#71767B]">Detected public URL</p>
          <p className="mt-2 break-all text-lg font-black text-white">{appUrl}</p>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Resolved from admin setting or request proxy headers.</p>
        </section>
        <section className="border border-[#2F3336] bg-black p-5">
          <ShieldCheck className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-sm font-bold text-[#71767B]">Canonical domain</p>
          <p className="mt-2 break-all text-lg font-black text-white">{configuredHost || 'Auto-detected'}</p>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Set Public site URL in General Settings to lock SEO and callback links to one domain.</p>
        </section>
        <section className="border border-[#2F3336] bg-black p-5">
          <CheckCircle2 className="text-[#00BA7C]" size={22} />
          <p className="mt-4 text-sm font-bold text-[#71767B]">Domain readiness</p>
          <p className="mt-2 text-lg font-black text-white">{rows.filter((row) => row.verified).length} verified</p>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Verification is optional for single-site installs and useful for buyer support checks.</p>
        </section>
      </div>

      <form className="card mb-6 grid gap-3 md:grid-cols-[1fr_auto]" action="/api/admin/domains" method="post">
          <CsrfInput />
        <input className="input" name="domain" placeholder={detectedHost || 'academy.example.com'} />
        <button className="btn-primary">Create TXT Token</button>
      </form>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <DataTable
          headers={['Domain', 'DNS TXT record', 'Status', 'Actions']}
          rows={rows.map((domain) => [
            <div key="domain">
              <p className="font-black text-white">{domain.domain}</p>
              <p className="mt-1 text-xs text-[#71767B]">Host: _learnova.{domain.domain}</p>
              {configuredHost === domain.domain ? <p className="mt-2 text-xs font-bold text-[#00BA7C]">Active public URL</p> : null}
            </div>,
            <div key="token" className="space-y-2">
              <CopyLink value={domain.token} label="Copy TXT" copiedLabel="Copied" ariaLabel={`DNS TXT token for ${domain.domain}`} absolute={false} />
              <p className="text-xs text-[#71767B]">Add this as a TXT value on _learnova.{domain.domain}.</p>
            </div>,
            <Badge key="status" tone={domain.verified ? 'green' : 'yellow'}>
              {domain.verified ? 'Verified' : 'Pending'}
            </Badge>,
            <div key="actions" className="flex flex-wrap gap-2">
              <form action="/api/admin/domains" method="post">
          <CsrfInput />
                <input type="hidden" name="action" value="verify" />
                <input type="hidden" name="domain" value={domain.domain} />
                <button className="btn-secondary whitespace-nowrap">Check DNS</button>
              </form>
              {domain.verified ? (
                <form action="/api/admin/domains" method="post">
          <CsrfInput />
                  <input type="hidden" name="action" value="set-public-url" />
                  <input type="hidden" name="domain" value={domain.domain} />
                  <button className="btn-secondary whitespace-nowrap" disabled={configuredHost === domain.domain}>
                    {configuredHost === domain.domain ? 'Active' : 'Set Public URL'}
                  </button>
                </form>
              ) : null}
              <form action="/api/admin/domains" method="post">
          <CsrfInput />
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="domain" value={domain.domain} />
                <button className="btn-secondary whitespace-nowrap border-[#F4212E] text-[#F4212E] hover:bg-[#1f0508]">Delete</button>
              </form>
            </div>,
          ])}
        />

        <section className="border border-[#2F3336] bg-black">
          <div className="border-b border-[#2F3336] p-5">
            <div className="flex items-center gap-2">
              <Link2 className="text-[#1D9BF0]" size={20} />
              <h2 className="text-xl font-black text-white">Generated URLs</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">Use these URLs in payment, OAuth, and SEO provider dashboards.</p>
          </div>
          <div className="divide-y divide-[#2F3336]">
            {callbackRows(appUrl).map(([label, url]) => (
              <div className="p-4" key={label}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#71767B]">{label}</p>
                <div className="mt-2">
                  <CopyLink value={url} label="Copy" copiedLabel="Copied" ariaLabel={`${label} URL`} absolute={false} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
