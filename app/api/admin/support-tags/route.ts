import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const hexColor = /^#[0-9a-f]{6}$/i;

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/support-tags', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Support tag id is required.', 422);
      await prisma.supportTag.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'support_tag.delete', entity: 'SupportTag', entityId: id });
      return redirect(req);
    }

    const name = value(form, 'name').toLowerCase();
    const color = value(form, 'color') || '#0284c7';
    if (name.length < 2) return fail('Support tag name is required.', 422);
    if (!hexColor.test(color)) return fail('Support tag color must be a hex color such as #0284c7.', 422);

    const data = { name, color };
    if (action === 'update') {
      if (!id) return fail('Support tag id is required.', 422);
      await prisma.supportTag.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'support_tag.update', entity: 'SupportTag', entityId: id });
      return redirect(req);
    }

    const row = await prisma.supportTag.upsert({ where: { name }, update: { color }, create: data });
    await audit({ actorId: admin.id, action: 'support_tag.upsert', entity: 'SupportTag', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Support tag update failed.', 500);
  }
}
