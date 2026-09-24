import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { appUrlFromRequest } from '@/lib/app-url';
import { audit } from '@/lib/audit';
import { dispatchAutomationEvent } from '@/lib/automation';
import { requireUser } from '@/lib/auth';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { dispatchEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const courseId = String(form.get('id'));
    const course = await prisma.course.update({
      where: { id: courseId },
      data: { status: 'PUBLISHED' },
      include: { instructor: { select: { name: true, email: true, locale: true } } },
    });
    await invalidateCourseCatalogCache();
    await audit({
      actorId: admin.id,
      action: 'course.publish',
      entity: 'course',
      entityId: course.id,
      metadata: { title: course.title, slug: course.slug, instructorId: course.instructorId },
    });

    const appUrl = appUrlFromRequest(req);
    void dispatchEmail({
      to: course.instructor.email,
      templateKey: 'course-approved',
      variables: {
        instructorName: course.instructor.name,
        courseTitle: course.title,
        courseUrl: `${appUrl}/courses/${course.slug}`,
      },
      locale: course.instructor.locale,
    });
    void dispatchAutomationEvent('course.published', {
      courseId: course.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      courseUrl: `${appUrl}/courses/${course.slug}`,
      instructorId: course.instructorId,
      instructorEmail: course.instructor.email,
      instructorName: course.instructor.name,
    });

    return NextResponse.redirect(new URL('/admin/courses', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
