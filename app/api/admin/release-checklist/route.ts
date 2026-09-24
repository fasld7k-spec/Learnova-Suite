import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/release-checklist', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(value(form, 'csrfToken')))) return fail('Invalid CSRF token.', 403);

    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Checklist item id is required.', 422);
      await prisma.releaseChecklist.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'release_checklist.delete', entity: 'ReleaseChecklist', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Checklist item id is required.', 422);
      const current = await prisma.releaseChecklist.findUnique({ where: { id } });
      if (!current) return fail('Checklist item not found.', 404);
      const next = await prisma.releaseChecklist.update({ where: { id }, data: { done: !current.done } });
      await audit({
        actorId: admin.id,
        action: next.done ? 'release_checklist.mark_done' : 'release_checklist.mark_pending',
        entity: 'ReleaseChecklist',
        entityId: id,
      });
      return redirect(req);
    }

    const title = value(form, 'title');
    const sortOrder = Number(value(form, 'sortOrder') || 0);
    const done = form.get('done') === 'on';
    if (title.length < 2) return fail('Checklist title is required.', 422);
    if (!Number.isInteger(sortOrder)) return fail('Sort order must be an integer.', 422);

    const data = { title, sortOrder, done };
    if (action === 'update') {
      if (!id) return fail('Checklist item id is required.', 422);
      await prisma.releaseChecklist.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'release_checklist.update', entity: 'ReleaseChecklist', entityId: id });
      return redirect(req);
    }

    const row = await prisma.releaseChecklist.create({ data });
    await audit({ actorId: admin.id, action: 'release_checklist.create', entity: 'ReleaseChecklist', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Release checklist update failed.', 500);
  }
}
