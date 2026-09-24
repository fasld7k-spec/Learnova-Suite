import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { filterInAppNotificationRecipients } from '@/lib/notification-preferences';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const audiences = new Set(['ALL', 'STUDENT', 'INSTRUCTOR']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/announcements', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function notifyAudience(title: string, body: string, audience: string) {
  const role = audience === 'ALL' ? undefined : audience as any;
  const users = await prisma.user.findMany({ where: role ? { role } : {} as any, select: { id: true } });
  const recipientIds = await filterInAppNotificationRecipients(users.map((user) => user.id));
  if (!recipientIds.length) return 0;
  await prisma.notification.createMany({ data: recipientIds.map((userId) => ({ userId, title, body })) });
  return recipientIds.length;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Announcement id is required.', 422);
      await prisma.announcement.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'announcement.delete', entity: 'Announcement', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Announcement id is required.', 422);
      const current = await prisma.announcement.findUnique({ where: { id } });
      if (!current) return fail('Announcement not found.', 404);
      const announcement = await prisma.announcement.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: announcement.active ? 'announcement.enable' : 'announcement.disable', entity: 'Announcement', entityId: id, metadata: { title: announcement.title } });
      return redirect(req);
    }

    if (action === 'resend') {
      if (!id) return fail('Announcement id is required.', 422);
      const announcement = await prisma.announcement.findUnique({ where: { id } });
      if (!announcement) return fail('Announcement not found.', 404);
      const recipients = await notifyAudience(announcement.title, announcement.body, announcement.audience);
      await audit({ actorId: admin.id, action: 'announcement.resend', entity: 'Announcement', entityId: id, metadata: { recipients } });
      return redirect(req);
    }

    const title = value(form, 'title');
    const body = value(form, 'body');
    const audience = value(form, 'audience') || 'ALL';
    const active = form.get('active') === 'on';
    if (title.length < 2) return fail('Announcement title is required.', 422);
    if (body.length < 4) return fail('Announcement body is required.', 422);
    if (!audiences.has(audience)) return fail('Announcement audience is invalid.', 422);

    const data = { title, body, audience, active };
    if (action === 'update') {
      if (!id) return fail('Announcement id is required.', 422);
      await prisma.announcement.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'announcement.update', entity: 'Announcement', entityId: id });
      return redirect(req);
    }

    const item = await prisma.announcement.create({ data });
    const recipients = active ? await notifyAudience(item.title, item.body, item.audience) : 0;
    await audit({ actorId: admin.id, action: 'announcement.create', entity: 'Announcement', entityId: item.id, metadata: { recipients } });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Announcement update failed.', 500);
  }
}
