import { cookies } from 'next/headers';
import { KeyRound, LockKeyhole, PlusCircle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { publicApiScopes } from '@/lib/api-key';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function ApiKeys() {
  await requireUser(['ADMIN']);

  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
  const generatedKey = (await cookies()).get('learnova_flash_api_key')?.value;
  const activeCount = keys.filter((key) => key.active).length;

  return (
    <DashboardShell role="admin" title="API Keys">
      {generatedKey && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#5EE4B3]" size={20} strokeWidth={1.8} />
            <div className="min-w-0">
              <p className="text-sm font-black text-[#5EE4B3]">Copy this API key now. It will not be shown again.</p>
              <code className="mt-3 block break-all rounded-md border border-[#2A3037] bg-[#050608] p-3 text-sm text-white">{generatedKey}</code>
            </div>
          </div>
        </div>
      )}

      <section className="ui-panel mb-6 overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2A3037] bg-[#101317] text-[#79C7FF]">
              <KeyRound size={22} strokeWidth={1.8} />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#79C7FF]">Developer access</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Issue scoped integration keys</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8A949E]">
              Generate keys for automation, mobile clients, and trusted integrations while keeping the secret visible only once. Select the permissions each key can use; public endpoints reject keys missing the required scope.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="ui-panel-muted flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8A949E]">Total keys</p>
                <p className="mt-1 text-2xl font-black text-white">{keys.length}</p>
              </div>
              <LockKeyhole className="text-[#79C7FF]" size={20} strokeWidth={1.8} />
            </div>
            <div className="ui-panel-muted flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8A949E]">Active keys</p>
                <p className="mt-1 text-2xl font-black text-white">{activeCount}</p>
              </div>
              <ShieldCheck className="text-[#5EE4B3]" size={20} strokeWidth={1.8} />
            </div>
          </div>
        </div>
      </section>

      <form className="ui-panel mb-6 grid gap-4 p-5 sm:grid-cols-[1fr_auto]" action="/api/admin/api-keys" method="post">
          <CsrfInput />
        <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
          Integration name
          <input className="input" name="name" placeholder="Mobile app backend" required />
        </label>
        <fieldset className="grid gap-2 text-sm font-bold text-[#D7DEE4] sm:col-span-2">
          <legend>Allowed scopes</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {publicApiScopes.map((scope) => (
              <label key={scope.value} className="flex items-center gap-2 rounded-lg border border-[#2A3037] bg-[#101317] p-3 text-xs font-bold text-[#D7DEE4]">
                <input type="checkbox" name="scopes" value={scope.value} defaultChecked />
                {scope.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn-primary self-end">
          <PlusCircle size={16} />
          Generate API Key
        </button>
      </form>

      <DataTable
        headers={['Name', 'Scopes', 'Hash Preview', 'Active', 'Created', 'Manage']}
        rows={keys.map((key) => {
          const scopes = fromJsonArray<string>((key as any).scopes);
          return [
          <span className="font-black text-white" key={`${key.id}-name`}>{key.name}</span>,
          <span className="text-xs font-bold text-[#D7DEE4]" key={`${key.id}-scopes`}>{scopes.length ? scopes.join(', ') : 'No scopes'}</span>,
          <code className="rounded-md border border-[#2A3037] bg-[#101317] px-2 py-1 text-xs text-[#D7DEE4]" key={`${key.id}-hash`}>
            {key.keyHash.slice(0, 12)}...
          </code>,
          <Badge key={`${key.id}-active`} tone={key.active ? 'green' : 'red'}>{key.active ? 'Active' : 'Disabled'}</Badge>,
          key.createdAt.toLocaleDateString(),
          <div key={`${key.id}-manage`} className="flex min-w-72 flex-wrap gap-2">
            <form className="flex flex-wrap gap-2" action="/api/admin/api-keys" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={key.id} />
              <input className="input min-w-44" name="name" defaultValue={key.name} />
              {publicApiScopes.map((scope) => (
                <label key={scope.value} className="inline-flex items-center gap-1 text-xs font-bold text-[#D7DEE4]">
                  <input type="checkbox" name="scopes" value={scope.value} defaultChecked={scopes.includes(scope.value)} />
                  {scope.value}
                </label>
              ))}
              <button className="btn-secondary">Rename</button>
            </form>
            <form action="/api/admin/api-keys" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="toggle" />
              <input type="hidden" name="id" value={key.id} />
              <button className="btn-secondary">{key.active ? 'Disable' : 'Enable'}</button>
            </form>
            <form action="/api/admin/api-keys" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={key.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>
        ];
        })}
      />
    </DashboardShell>
  );
}
