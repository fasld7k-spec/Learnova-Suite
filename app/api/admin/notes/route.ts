import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/admin/notes', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

async function resolveEntityId(entity: string, reference: string) {
  if (entity === 'user') {
    const user = await prisma.user.findFirst({ where: { OR: [{ id: reference }, { email: reference }] }, select: { id: true } });
    return user?.id;
  }
  if (entity === 'course') {
    const course = await prisma.course.findFirst({ where: { OR: [{ id: reference }, { slug: reference }] }, select: { id: true } });
    return course?.id;
  }
  if (entity === 'order') {
    const order = await prisma.order.findFirst({ where: { OR: [{ id: reference }, { invoiceNumber: reference }] }, select: { id: true } });
    return order?.id;
  }
  if (entity === 'system') return 'system';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const entity = String(form.get('entity') || '').trim().toLowerCase();
    const reference = String(form.get('entityId') || '').trim();
    const note = String(form.get('note') || '').trim();

    if (!['user', 'course', 'order', 'system'].includes(entity)) return formError(req, 'Unsupported note type.');
    if (entity !== 'system' && !reference) return formError(req, 'Related record is required.');
    if (!note) return formError(req, 'Note text is required.');

    const entityId = await resolveEntityId(entity, reference);
    if (!entityId) return formError(req, 'Related record was not found.', 404);

    const row = await prisma.adminNote.create({ data: { adminId: admin.id, entity, entityId, note } });
    await audit({ actorId: admin.id, action: 'admin_note.create', entity: 'AdminNote', entityId: row.id, metadata: { targetEntity: entity, targetEntityId: entityId } });
    return NextResponse.redirect(new URL('/admin/notes', req.url), 303);
  } catch (e: any) {
    return formError(req, e.message || 'Unable to add note.', 500);
  }
}
