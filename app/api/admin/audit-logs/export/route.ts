import { NextRequest } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

function safeDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function auditWhere(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  const action = req.nextUrl.searchParams.get('action')?.trim() || '';
  const entity = req.nextUrl.searchParams.get('entity')?.trim() || '';
  const actor = req.nextUrl.searchParams.get('actor')?.trim() || '';
  const from = safeDate(req.nextUrl.searchParams.get('from'));
  const to = safeDate(req.nextUrl.searchParams.get('to'), true);
  const and: Prisma.AuditLogWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { action: { contains: q } },
        { entity: { contains: q } },
        { entityId: { contains: q } },
        { metadata: { contains: q } },
        { ip: { contains: q } },
      ],
    });
  }
  if (action) and.push({ action: { contains: action } });
  if (entity) and.push({ entity: { contains: entity } });
  if (actor) and.push({ actorId: actor });
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  return and.length ? { AND: and } : {};
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const where = auditWhere(req);
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 5000 });
    await audit({
      actorId: admin.id,
      action: 'audit_logs.export',
      entity: 'AuditLog',
      metadata: { count: logs.length },
    });
    return csvResponse(
      `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['id', 'action', 'entity', 'entityId', 'actorId', 'ip', 'metadata', 'createdAt'],
        logs.map((log) => [
          log.id,
          log.action,
          log.entity,
          log.entityId || '',
          log.actorId || '',
          log.ip || '',
          log.metadata || '',
          log.createdAt.toISOString(),
        ]),
      ),
    );
  } catch (error: any) {
    return fail(error.message || 'Audit export failed.', 500);
  }
}
