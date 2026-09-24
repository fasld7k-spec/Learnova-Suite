import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function olderThan(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();

    if (action === 'purge-old') {
      const days = Math.max(1, Math.round(Number(form.get('days') || 90)));
      const result = await prisma.courseView.deleteMany({ where: { createdAt: { lt: olderThan(days) } } });
      await audit({ actorId: admin.id, action: 'course_view.purge_old', entity: 'courseView', metadata: { days, deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/course-views?purged=1', req.url), 303);
    }

    if (action === 'delete') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('Course view ID is required.', 422);
      const row = await prisma.courseView.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'course_view.delete', entity: 'courseView', entityId: row.id, metadata: { courseId: row.courseId, userId: row.userId } });
      return NextResponse.redirect(new URL('/admin/course-views?deleted=1', req.url), 303);
    }

    return fail('Unsupported course view action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Course view action failed.', 500);
  }
}
