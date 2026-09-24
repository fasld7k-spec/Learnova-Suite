import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { dispatchAddonEvent } from '@/lib/addons';
import { requireUser } from '@/lib/auth';
import { dispatchPlatformWebhook } from '@/lib/outbound-webhooks';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    const enrollmentId = String(form.get('enrollmentId') || '').trim();
    const action = String(form.get('action') || '').trim().toLowerCase();

    if (action === 'issue') {
      if (!enrollmentId) return fail('Enrollment id is required.', 422);

      const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          certificate: true,
          course: { include: { instructor: true } },
          user: true,
        },
      });

      if (!enrollment) return fail('Enrollment not found.', 404);
      if (enrollment.certificate) {
        return NextResponse.redirect(new URL('/admin/certificates?exists=1', req.url), 303);
      }
      if (!enrollment.completedAt && enrollment.progress < 100) {
        return fail('Certificates can only be issued for completed enrollments.', 422);
      }

      const certificate = await prisma.certificate.create({
        data: {
          code: `CERT-${Date.now()}-${enrollment.userId.slice(0, 5)}`,
          userId: enrollment.userId,
          enrollmentId: enrollment.id,
          courseTitle: enrollment.course.title,
          instructorName: enrollment.course.instructor.name,
        },
      });

      const eventPayload = {
        certificateId: certificate.id,
        code: certificate.code,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.title,
        instructorName: enrollment.course.instructor.name,
        issuedAt: certificate.issuedAt.toISOString(),
        issuedBy: admin.id,
        source: 'admin',
      };

      await Promise.allSettled([
        dispatchAddonEvent('certificate.issued', eventPayload),
        dispatchPlatformWebhook('certificate.issued', eventPayload),
      ]);

      await audit({
        actorId: admin.id,
        action: 'certificate.issue',
        entity: 'certificate',
        entityId: certificate.id,
        metadata: {
          code: certificate.code,
          courseTitle: certificate.courseTitle,
          userId: certificate.userId,
          enrollmentId: certificate.enrollmentId,
        },
      });

      return NextResponse.redirect(new URL('/admin/certificates?issued=1', req.url), 303);
    }

    if (action !== 'delete') return fail('Unsupported certificate action.', 422);
    if (!id) return fail('Certificate id is required.', 422);

    const certificate = await prisma.certificate.findUnique({ where: { id } });
    if (!certificate) return fail('Certificate not found.', 404);

    await prisma.certificate.delete({ where: { id } });
    await audit({
      actorId: admin.id,
      action: 'certificate.delete',
      entity: 'certificate',
      entityId: id,
      metadata: { code: certificate.code, courseTitle: certificate.courseTitle, userId: certificate.userId },
    });

    return NextResponse.redirect(new URL('/admin/certificates', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Unable to update certificate.', 500);
  }
}
