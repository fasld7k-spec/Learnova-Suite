import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

type AuditLogSearchParams = {
  q?: string;
  action?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
  purged?: string;
};

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function safeDate(value: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function metadataPreview(value?: string | null) {
  if (!value) return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default async function AuditLogs(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const highRiskSince = new Date();
  highRiskSince.setHours(highRiskSince.getHours() - 24);
  const params = (await props.searchParams) || {};
  const filters: AuditLogSearchParams = {
    q: param(params.q).trim(),
    action: param(params.action).trim(),
    entity: param(params.entity).trim(),
    actor: param(params.actor).trim(),
    from: param(params.from).trim(),
    to: param(params.to).trim(),
    purged: param(params.purged).trim(),
  };
  const from = safeDate(filters.from || '');
  const to = safeDate(filters.to || '', true);
  const and: Prisma.AuditLogWhereInput[] = [];
  if (filters.q) {
    and.push({
      OR: [
        { action: { contains: filters.q } },
        { entity: { contains: filters.q } },
        { entityId: { contains: filters.q } },
        { metadata: { contains: filters.q } },
        { ip: { contains: filters.q } },
      ],
    });
  }
  if (filters.action) and.push({ action: { contains: filters.action } });
  if (filters.entity) and.push({ entity: { contains: filters.entity } });
  if (filters.actor) and.push({ actorId: filters.actor });
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

  const [logs, totalCount, filteredCount, actionGroups, entityGroups, recentFailures] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 250 }),
    prisma.auditLog.count(),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['action'], _count: { action: true }, orderBy: { _count: { action: 'desc' } }, take: 8 }),
    prisma.auditLog.groupBy({ by: ['entity'], _count: { entity: true }, orderBy: { _count: { entity: 'desc' } }, take: 8 }),
    prisma.auditLog.count({
      where: {
        OR: [{ action: { contains: 'fail' } }, { action: { contains: 'reject' } }, { action: { contains: 'delete' } }],
        createdAt: { gte: highRiskSince },
      },
    }),
  ]);
  const actorIds = logs.map((log) => log.actorId).filter(Boolean) as string[];
  const entityUserIds = logs.filter((log) => log.entity.toLowerCase() === 'user' && log.entityId).map((log) => log.entityId as string);
  const courseIds = logs.filter((log) => log.entity.toLowerCase() === 'course' && log.entityId).map((log) => log.entityId as string);
  const orderIds = logs.filter((log) => log.entity.toLowerCase() === 'order' && log.entityId).map((log) => log.entityId as string);

  const [users, courses, orders] = await Promise.all([
    actorIds.length || entityUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: Array.from(new Set([...actorIds, ...entityUserIds])) } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    courseIds.length ? prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    orderIds.length ? prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, invoiceNumber: true } }) : Promise.resolve([]),
  ]);

  const usersById = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));
  const coursesById = new Map(courses.map((course) => [course.id, course.title]));
  const ordersById = new Map(orders.map((order) => [order.id, order.invoiceNumber]));
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== 'purged' && value) exportParams.set(key, value);
  }
  const exportHref = `/api/admin/audit-logs/export${exportParams.size ? `?${exportParams.toString()}` : ''}`;

  function entityLabel(entity: string, entityId?: string | null) {
    if (!entityId) return entity;
    const key = entity.toLowerCase();
    if (key === 'user') return usersById.get(entityId) || 'Deleted user';
    if (key === 'course') return coursesById.get(entityId) || 'Archived course';
    if (key === 'order') return ordersById.get(entityId) || 'Order';
    return entity;
  }

  return (
    <DashboardShell role="admin" title="Audit Logs">
      {filters.purged && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          Removed {filters.purged} old audit log record(s).
        </div>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total events" value={totalCount} />
        <StatCard label="Filtered events" value={filteredCount} />
        <StatCard label="High-risk 24h" value={recentFailures} />
        <StatCard label="Visible rows" value={logs.length} />
      </div>
      <form className="card mb-6 grid gap-3" action="/admin/audit-logs" method="get">
        <div>
          <h2 className="text-xl font-black text-white">Audit filters</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Search admin activity by action, entity, actor, metadata, IP address, and date range before exporting evidence.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Search action, metadata, entity id, or IP" />
          <input className="input" name="action" defaultValue={filters.action} placeholder="Action contains, e.g. payment" />
          <input className="input" name="entity" defaultValue={filters.entity} placeholder="Entity contains, e.g. Course" />
          <input className="input" name="actor" defaultValue={filters.actor} placeholder="Actor user id" />
          <input className="input" name="from" type="date" defaultValue={filters.from} aria-label="From date" />
          <input className="input" name="to" type="date" defaultValue={filters.to} aria-label="To date" />
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary">Apply filters</button>
          <a className="btn-secondary" href="/admin/audit-logs">Reset</a>
        </div>
      </form>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-lg font-black text-white">Top actions</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#E7E9EA]">
            {actionGroups.map((group) => (
              <div key={group.action} className="flex items-center justify-between border-t border-[#2F3336] py-2">
                <span>{group.action}</span>
                <strong>{group._count.action}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-black text-white">Top entities</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#E7E9EA]">
            {entityGroups.map((group) => (
              <div key={group.entity} className="flex items-center justify-between border-t border-[#2F3336] py-2">
                <span>{group.entity}</span>
                <strong>{group._count.entity}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <a className="btn-primary" href={exportHref}>Export Audit CSV</a>
        <form action="/api/admin/audit-logs" method="post" className="flex flex-wrap items-center gap-2">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge-old" />
          <input className="input w-36" name="days" type="number" min="30" defaultValue={365} aria-label="Audit retention days" />
          <button className="btn-secondary">Purge old logs</button>
        </form>
      </div>
      <DataTable
        headers={['Action', 'Entity', 'Actor', 'IP', 'Details', 'Date']}
        rows={logs.map((log) => [
          log.action,
          entityLabel(log.entity, log.entityId),
          log.actorId ? usersById.get(log.actorId) || 'System user' : 'System',
          log.ip || '-',
          <details key="details" className="max-w-lg text-sm text-[#E7E9EA]">
            <summary className="cursor-pointer font-bold text-[#1D9BF0]">Metadata</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap border border-[#2F3336] bg-black p-3 text-xs text-[#E7E9EA]">
              {metadataPreview(log.metadata)}
            </pre>
          </details>,
          log.createdAt.toLocaleString(),
        ])}
      />
    </DashboardShell>
  );
}
