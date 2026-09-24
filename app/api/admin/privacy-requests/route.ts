import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import {
  completeDataDeletionRequest,
  completeDataExportRequest,
  rejectDataDeletionRequest,
  rejectDataExportRequest,
} from '@/lib/privacy-requests';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/privacy-requests', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const type = value(form, 'type');
    const action = value(form, 'action');
    const id = value(form, 'id');
    const reason = value(form, 'reason');
    if (!id) return fail('Request id is required.', 422);

    if (type === 'export' && action === 'complete') await completeDataExportRequest(id, admin.id);
    else if (type === 'export' && action === 'reject') await rejectDataExportRequest(id, reason);
    else if (type === 'deletion' && action === 'complete') await completeDataDeletionRequest(id, admin.id);
    else if (type === 'deletion' && action === 'reject') await rejectDataDeletionRequest(id, reason);
    else return fail('Unsupported privacy request action.', 422);

    await audit({
      actorId: admin.id,
      action: `privacy_request.${type}.${action}`,
      entity: type === 'deletion' ? 'DataDeletionRequest' : 'DataExportRequest',
      entityId: id,
      metadata: { reason: reason || undefined },
    });

    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Privacy request update failed.', 500);
  }
}
