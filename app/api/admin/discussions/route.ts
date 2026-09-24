import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/discussions', req.url), 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    const action = String(form.get('action') || '').trim().toLowerCase();

    if (!id) return fail('Discussion topic id is required.', 422);
    if (!['pin', 'lock', 'delete'].includes(action)) return fail('Unsupported discussion action.', 422);

    const topic = await prisma.discussionTopic.findUnique({ where: { id } });
    if (!topic) return fail('Discussion topic not found.', 404);

    if (action === 'delete') {
      await prisma.discussionTopic.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'discussion.delete', entity: 'discussionTopic', entityId: id });
      return redirect(req);
    }

    const data = action === 'pin' ? { pinned: !topic.pinned } : { locked: !topic.locked };
    const updated = await prisma.discussionTopic.update({ where: { id }, data });
    await audit({
      actorId: admin.id,
      action: `discussion.${action}`,
      entity: 'discussionTopic',
      entityId: id,
      metadata: data,
    });

    return req.headers.get('accept')?.includes('application/json') ? Response.json(updated) : redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Unable to update discussion topic.', 500);
  }
}
