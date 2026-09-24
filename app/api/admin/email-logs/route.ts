import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();
    const id = String(form.get('id') || '').trim();
    if (action !== 'delete') return fail('Unsupported email log action.', 422);
    if (!id) return fail('Email log ID is required.', 422);

    const log = await prisma.emailLog.delete({ where: { id } });
    await audit({ actorId: admin.id, action: 'email_log.delete', entity: 'emailLog', entityId: log.id, metadata: { to: log.to, status: log.status } });
    return NextResponse.redirect(new URL('/admin/email-logs?deleted=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Email log action failed.', 500);
  }
}
