import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { appUrlFromRequest } from '@/lib/app-url';
import { audit } from '@/lib/audit';
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
    const reason = String(form.get('reason') || '');
    const course = await prisma.course.update({
      where: { id: courseId },
      data: { status: 'REJECTED' },
      include: { instructor: { select: { name: true, email: true, locale: true } } },
    });
    await invalidateCourseCatalogCache();
    await audit({
      actorId: admin.id,
      action: 'course.reject',
      entity: 'course',
      entityId: course.id,
      metadata: { title: course.title, slug: course.slug, instructorId: course.instructorId, reason },
    });

    const appUrl = appUrlFromRequest(req);
    void dispatchEmail({
      to: course.instructor.email,
      templateKey: 'course-rejected',
      variables: {
        instructorName: course.instructor.name,
        courseTitle: course.title,
        rejectionReason: reason || 'Please review the course guidelines.',
        editUrl: `${appUrl}/instructor/courses/${course.id}/edit`,
      },
      locale: course.instructor.locale,
    });

    return NextResponse.redirect(new URL('/admin/courses', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
