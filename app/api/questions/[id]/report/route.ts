import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';
import { safeRedirectPath } from '@/lib/safe-redirect';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const limited = enforceRateLimit(req, 'public.question-report', 10, 10 * 60_000);
    if (limited) return limited;

    const { id } = await params;
    const type = req.headers.get('content-type') || '';
    const data = type.includes('application/json')
      ? await req.json().catch(() => ({}))
      : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
    const csrfToken = req.headers.get('x-csrf-token') || String(data.csrfToken || '');
    if (!(await verifyCsrf(csrfToken))) return fail('Invalid CSRF token.', 403);
    const reason = String(data.reason || '').trim().slice(0, 1000);
    const redirect = String(data.redirect || '');
    if (reason.length < 5) return fail('Report reason must be at least 5 characters.', 422);

    const session = await getSession();
    const user = session ? await prisma.user.findUnique({ where: { id: session.id } }) : null;
    const report = await prisma.abuseReport.create({
      data: {
        reporterEmail: user?.email || String(data.reporterEmail || '').trim().slice(0, 255) || null,
        targetType: 'QUESTION',
        targetId: id,
        reason,
      },
    });

    if (redirect) return NextResponse.redirect(new URL(safeRedirectPath(redirect, '/community'), req.url), 303);
    return ok(report);
  } catch (e) {
    return handleError(e);
  }
}
