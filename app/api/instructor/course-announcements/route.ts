import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(f.get('action') || 'create');

    if (action === 'delete') {
      const courses = await prisma.course.findMany({ where: { instructorId: user.id }, select: { id: true } });
      const row = await prisma.courseAnnouncement.findFirst({
        where: { id: String(f.get('announcementId') || ''), courseId: { in: courses.map((course) => course.id) } }
      });
      if (!row) return fail('Announcement not found', 404);
      await prisma.courseAnnouncement.delete({ where: { id: row.id } });
      return NextResponse.redirect(new URL('/instructor/course-announcements', req.url), 303);
    }

    const course = await prisma.course.findFirst({ where: { id: String(f.get('courseId')), instructorId: user.id }, include: { enrollments: true } });
    if (!course) return fail('Course not found', 404);
    const title = String(f.get('title') || '').trim();
    const body = String(f.get('body') || '').trim();
    if (!title || !body) return fail('Title and announcement body are required.', 422);
    const announcement = await prisma.courseAnnouncement.create({ data: { courseId: course.id, title, body } });
    await prisma.notification.createMany({ data: course.enrollments.map((enrollment) => ({ userId: enrollment.userId, title: announcement.title, body: announcement.body })) }).catch(() => null);
    return NextResponse.redirect(new URL('/instructor/course-announcements', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
