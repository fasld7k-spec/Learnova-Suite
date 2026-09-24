import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { verifyCsrf } from '@/lib/csrf';

function courseUrl(slug: string, publicAppUrl: string) {
  const base = publicAppUrl.replace(/\/$/, '');
  return `${base}/courses/${slug}`;
}

async function sendInvite(row: { email: string; courseId: string }) {
  const [course, settings] = await Promise.all([
    prisma.course.findUnique({ where: { id: row.courseId }, select: { title: true, slug: true } }),
    getSiteSettings(),
  ]);
  if (!course) throw new Error('Course not found.');
  const token = randomUUID();
  const invite = await prisma.bulkEnrollmentInvite.create({
    data: { email: row.email, courseId: row.courseId, token },
  });
  const inviteUrl = `${settings.publicAppUrl.replace(/\/$/, '')}/api/enrollment-invites/accept?token=${encodeURIComponent(invite.token)}`;
  await sendEmail({
    to: row.email,
    subject: `${course.title} is ready`,
    html: `<p>The course <strong>${course.title}</strong> is now available.</p><p><a href="${inviteUrl}">Accept your invite</a></p><p><a href="${courseUrl(course.slug, settings.publicAppUrl)}">Open course page</a></p>`,
  });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();
    const id = String(form.get('id') || '').trim();
    const courseId = String(form.get('courseId') || '').trim();

    if (action === 'invite_course') {
      if (!courseId) return fail('Course ID is required.', 422);
      const rows = await prisma.courseWaitlist.findMany({ where: { courseId }, take: 500 });
      let invited = 0;
      for (const row of rows) {
        await sendInvite(row);
        invited += 1;
      }
      await audit({ actorId: admin.id, action: 'waitlist.invite_course', entity: 'courseWaitlist', entityId: courseId, metadata: { invited } });
      return NextResponse.redirect(new URL(`/admin/waitlists?invited=${invited}`, req.url), 303);
    }

    if (action === 'delete_course') {
      if (!courseId) return fail('Course ID is required.', 422);
      const result = await prisma.courseWaitlist.deleteMany({ where: { courseId } });
      await audit({ actorId: admin.id, action: 'waitlist.delete_course', entity: 'courseWaitlist', entityId: courseId, metadata: { deleted: result.count } });
      return NextResponse.redirect(new URL(`/admin/waitlists?deleted=${result.count}`, req.url), 303);
    }

    if (!id) return fail('Waitlist ID is required.', 422);

    const row = await prisma.courseWaitlist.findUnique({ where: { id } });
    if (!row) return fail('Waitlist record not found.', 404);

    if (action === 'delete') {
      await prisma.courseWaitlist.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'waitlist.delete', entity: 'courseWaitlist', entityId: id, metadata: { courseId: row.courseId, email: row.email } });
      return NextResponse.redirect(new URL('/admin/waitlists?deleted=1', req.url), 303);
    }

    if (action === 'invite') {
      await sendInvite(row);
      await audit({ actorId: admin.id, action: 'waitlist.invite', entity: 'courseWaitlist', entityId: id, metadata: { courseId: row.courseId, email: row.email } });
      return NextResponse.redirect(new URL('/admin/waitlists?invited=1', req.url), 303);
    }

    return fail('Unsupported waitlist action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Waitlist action failed.', 500);
  }
}
