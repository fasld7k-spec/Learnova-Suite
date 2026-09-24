import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();
    const id = String(form.get('id') || '').trim();
    if (action !== 'delete') return fail('Unsupported instructor review action.', 422);
    if (!id) return fail('Instructor review ID is required.', 422);

    const review = await prisma.instructorReview.delete({ where: { id } });
    await audit({
      actorId: admin.id,
      action: 'instructor_review.delete',
      entity: 'instructorReview',
      entityId: review.id,
      metadata: { instructorId: review.instructorId, userId: review.userId, rating: review.rating },
    });

    return NextResponse.redirect(new URL('/admin/instructor-reviews?deleted=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Instructor review could not be updated.', 500);
  }
}
