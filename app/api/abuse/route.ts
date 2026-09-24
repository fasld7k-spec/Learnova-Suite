import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

function clean(value: unknown, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.abuse', 10, 10 * 60_000);
  if (limited) return limited;

  const body = await req.json().catch((): unknown => null);
  if (!isRecord(body)) return fail('Invalid JSON body', 400);

  const targetType = clean(body.targetType, 40).toUpperCase();
  const targetId = clean(body.targetId, 160);
  const reason = clean(body.reason, 1000);
  const reporterEmail = clean(body.reporterEmail, 180);

  if (!targetType || !targetId || reason.length < 5) {
    return fail('Missing required fields', 422);
  }
  if (!/^[A-Z0-9_-]+$/.test(targetType)) return fail('Invalid target type', 422);
  if (reporterEmail && !reporterEmail.includes('@')) return fail('Invalid reporter email', 422);

  const report = await prisma.abuseReport.create({
    data: {
      reporterEmail: reporterEmail || null,
      targetType,
      targetId,
      reason,
    },
  });
  return ok(report);
}
