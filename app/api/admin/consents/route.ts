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
    if (action === 'delete_type') {
      const type = String(form.get('type') || '').trim();
      if (!type) return fail('Consent type is required.', 422);
      const result = await prisma.consentRecord.deleteMany({ where: { type } });
      await audit({ actorId: admin.id, action: 'consent.delete_type', entity: 'consentRecord', metadata: { type, deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/consents?deleted=1', req.url), 303);
    }

    if (action !== 'delete') return fail('Unsupported consent action.', 422);
    if (!id) return fail('Consent ID is required.', 422);
    const record = await prisma.consentRecord.delete({ where: { id } });
    await audit({ actorId: admin.id, action: 'consent.delete', entity: 'consentRecord', entityId: record.id, metadata: { type: record.type, userId: record.userId, granted: record.granted } });
    return NextResponse.redirect(new URL('/admin/consents?deleted=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Consent action failed.', 500);
  }
}
