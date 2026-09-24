import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const actions = new Set(['FLAG', 'HIDE', 'REJECT']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/moderation-rules', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const mode = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (mode === 'delete') {
      if (!id) return fail('Rule id is required.', 422);
      await prisma.contentModerationRule.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'moderation_rule.delete', entity: 'ContentModerationRule', entityId: id });
      return redirect(req);
    }

    if (mode === 'toggle') {
      if (!id) return fail('Rule id is required.', 422);
      const current = await prisma.contentModerationRule.findUnique({ where: { id } });
      if (!current) return fail('Rule not found.', 404);
      const rule = await prisma.contentModerationRule.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: rule.active ? 'moderation_rule.enable' : 'moderation_rule.disable', entity: 'ContentModerationRule', entityId: id });
      return redirect(req);
    }

    const pattern = value(form, 'pattern');
    const action = value(form, 'action').toUpperCase() || 'FLAG';
    if (pattern.length < 2) return fail('Pattern must be at least 2 characters.', 422);
    if (!actions.has(action)) return fail('Invalid moderation action.', 422);

    const data = { pattern, action, active: form.get('active') === 'on' };
    if (mode === 'update') {
      if (!id) return fail('Rule id is required.', 422);
      await prisma.contentModerationRule.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'moderation_rule.update', entity: 'ContentModerationRule', entityId: id });
      return redirect(req);
    }

    const rule = await prisma.contentModerationRule.create({ data });
    await audit({ actorId: admin.id, action: 'moderation_rule.create', entity: 'ContentModerationRule', entityId: rule.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Moderation rule update failed.', 500);
  }
}
