import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { awardAchievement } from '@/lib/achievements';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/badges', req.url), 303);
}

function value(form: FormData, key: string, max = 220) {
  return String(form.get(key) || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function assertStudent(userId: string) {
  if (!userId) throw new Error('Student is required.');
  const user = await prisma.user.findFirst({ where: { id: userId, role: 'STUDENT' }, select: { id: true } });
  if (!user) throw new Error('Student not found.');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData().catch(() => new FormData());
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action', 20) || 'create';
    const id = value(form, 'id', 80);

    if (action === 'delete') {
      if (!id) return fail('Achievement id is required.', 422);
      await prisma.badgeAward.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'achievement.delete', entity: 'BadgeAward', entityId: id });
      return redirect(req);
    }

    const userId = value(form, 'userId', 80);
    const title = value(form, 'title', 120);
    const icon = value(form, 'icon', 40) || null;
    const reason = value(form, 'reason', 220);

    if (title.length < 2) return fail('Achievement title is required.', 422);
    if (reason.length < 2) return fail('Achievement reason is required.', 422);
    await assertStudent(userId);

    if (action === 'update') {
      if (!id) return fail('Achievement id is required.', 422);
      await prisma.badgeAward.update({
        where: { id },
        data: { userId, title, icon, reason },
      });
      await audit({ actorId: admin.id, action: 'achievement.update', entity: 'BadgeAward', entityId: id });
      return redirect(req);
    }

    const badge = await awardAchievement({ userId, title, icon, reason });
    if (badge) {
      await audit({ actorId: admin.id, action: 'achievement.create', entity: 'BadgeAward', entityId: badge.id });
    }
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Achievement update failed.', 500);
  }
}
