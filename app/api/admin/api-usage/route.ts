import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { csvResponse, toCsv } from '@/lib/csv';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

function olderThan(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function safeDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function usageWhere(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  const status = req.nextUrl.searchParams.get('status')?.trim() || '';
  const from = safeDate(req.nextUrl.searchParams.get('from'));
  const to = safeDate(req.nextUrl.searchParams.get('to'), true);
  const and: Prisma.ApiUsageLogWhereInput[] = [];
  if (q) and.push({ OR: [{ path: { contains: q } }, { method: { contains: q } }, { apiKeyId: { contains: q } }] });
  if (status) and.push({ status: Number(status) });
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  return and.length ? { AND: and } : {};
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const rows = await prisma.apiUsageLog.findMany({ where: usageWhere(req), orderBy: { createdAt: 'desc' }, take: 5000 });
    await audit({ actorId: admin.id, action: 'api_usage.export', entity: 'apiUsageLog', metadata: { rows: rows.length } });
    return csvResponse(
      `api-usage-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['id', 'apiKeyId', 'path', 'method', 'status', 'createdAt'],
        rows.map((row) => [row.id, row.apiKeyId || '', row.path, row.method, row.status, row.createdAt.toISOString()]),
      ),
    );
  } catch (error: any) {
    return fail(error.message || 'API usage export failed.', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();

    if (action === 'purge-old') {
      const days = Math.max(1, Math.round(Number(form.get('days') || 90)));
      const result = await prisma.apiUsageLog.deleteMany({ where: { createdAt: { lt: olderThan(days) } } });
      await audit({ actorId: admin.id, action: 'api_usage.purge_old', entity: 'apiUsageLog', metadata: { days, deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/api-usage?purged=1', req.url), 303);
    }

    if (action === 'delete') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('API usage log ID is required.', 422);
      const row = await prisma.apiUsageLog.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'api_usage.delete', entity: 'apiUsageLog', entityId: row.id, metadata: { path: row.path, method: row.method, status: row.status } });
      return NextResponse.redirect(new URL('/admin/api-usage?deleted=1', req.url), 303);
    }

    return fail('Unsupported API usage action.', 422);
  } catch (error: any) {
    return fail(error.message || 'API usage action failed.', 500);
  }
}
