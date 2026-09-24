import { ArchiveRestore, Clock3, DatabaseBackup, Download, ServerCog, Trash2 } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { listLocalBackupFiles } from '@/lib/backups';
import { prisma } from '@/lib/prisma';

function formatBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export default async function Backups(props: { searchParams?: Promise<{ deleted?: string; logDeleted?: string; logsCleared?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const [rows, files] = await Promise.all([
    prisma.backupLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    listLocalBackupFiles(),
  ]);
  const latest = rows[0];
  const successCount = rows.filter((backup) => backup.status === 'SUCCESS').length;
  const failedCount = rows.filter((backup) => backup.status === 'FAILED').length;

  return (
    <DashboardShell role="admin" title="Backups">
      {searchParams?.deleted && <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Backup file deleted.</div>}
      {searchParams?.logDeleted && <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Backup log entry deleted.</div>}
      {searchParams?.logsCleared && <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Failed backup logs cleared.</div>}

      <section className="ui-panel overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2A3037] bg-[#101317] text-[#79C7FF]">
              <DatabaseBackup size={22} strokeWidth={1.8} />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#79C7FF]">Recovery readiness</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Run and audit database backups</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8A949E]">
              Create local SQLite backup files, download them for offsite storage, remove stale archives, and keep a visible operational log for production handoff checks.
            </p>
            <form className="mt-5" action="/api/admin/backups/run" method="post">
              <CsrfInput />
              <button className="btn-primary">Run backup now</button>
            </form>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="ui-panel-muted flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8A949E]">Logged runs</p>
                <p className="mt-1 text-2xl font-black text-white">{rows.length}</p>
              </div>
              <ServerCog className="text-[#79C7FF]" size={20} strokeWidth={1.8} />
            </div>
            <div className="ui-panel-muted flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8A949E]">Local files</p>
                <p className="mt-1 text-2xl font-black text-white">{files.length}</p>
              </div>
              <ArchiveRestore className="text-[#5EE4B3]" size={20} strokeWidth={1.8} />
            </div>
            <div className="ui-panel-muted flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8A949E]">Latest run</p>
                <p className="mt-1 text-sm font-black text-white">{latest ? latest.createdAt.toLocaleDateString() : 'No backups yet'}</p>
              </div>
              <Clock3 className="text-[#FFE36E]" size={20} strokeWidth={1.8} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Backup Files</h2>
            <p className="mt-1 text-sm text-[#71767B]">Local SQLite archives stored under storage/backups. Move production copies to private offsite storage.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">{successCount} successful runs</Badge>
            <Badge tone={failedCount ? 'red' : 'slate'}>{failedCount} failed runs</Badge>
          </div>
        </div>
        <DataTable
          headers={['File', 'Size', 'Updated', 'Manage']}
          rows={files.map((file) => [
            <div key="file" className="min-w-72">
              <p className="font-black text-white">{file.name}</p>
              <code className="mt-1 block break-all text-xs text-[#71767B]">{file.relativePath}</code>
            </div>,
            formatBytes(file.size),
            file.updatedAt.toLocaleString(),
            <div key="manage" className="flex flex-wrap gap-2">
              <a className="btn-secondary" href={`/api/admin/backups?file=${encodeURIComponent(file.name)}`}>
                <Download size={16} />
                Download
              </a>
              <form action="/api/admin/backups" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="delete_file" />
                <input type="hidden" name="file" value={file.name} />
                <button className="btn-secondary border-red-400/40 text-red-200">
                  <Trash2 size={16} />
                  Delete
                </button>
              </form>
            </div>,
          ])}
        />
      </section>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Backup Run Log</h2>
            <p className="mt-1 text-sm text-[#71767B]">Audit trail for manual and environment-level backup checks.</p>
          </div>
          {failedCount > 0 && (
            <form action="/api/admin/backups" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="clear_failed_logs" />
              <button className="btn-secondary">Clear failed logs</button>
            </form>
          )}
        </div>
        <DataTable
          headers={['Type', 'Status', 'Message', 'Date', 'Manage']}
          rows={rows.map((backup) => [
            <span className="font-black text-white" key={`${backup.id}-type`}>{backup.type}</span>,
            <Badge key={`${backup.id}-status`} tone={backup.status === 'SUCCESS' ? 'green' : 'red'}>
              {backup.status}
            </Badge>,
            backup.message || '-',
            backup.createdAt.toLocaleString(),
            <form key={`${backup.id}-delete`} action="/api/admin/backups" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="delete_log" />
              <input type="hidden" name="id" value={backup.id} />
              <button className="btn-secondary">Delete log</button>
            </form>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
