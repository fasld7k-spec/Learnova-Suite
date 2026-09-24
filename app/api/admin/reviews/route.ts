import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();
    const id = String(form.get('id') || '').trim();
    if (!id) return fail('Review ID is required.', 422);

    if (action === 'update') {
      const rating = Number(form.get('rating') || 0);
      const comment = String(form.get('comment') || '').trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail('Review rating must be from 1 to 5.', 422);
      const review = await prisma.review.update({ where: { id }, data: { rating, comment } });
      await invalidateCourseCatalogCache();
      await audit({
        actorId: admin.id,
        action: 'review.update',
        entity: 'review',
        entityId: review.id,
        metadata: { courseId: review.courseId, userId: review.userId, rating },
      });
      return NextResponse.redirect(new URL('/admin/reviews?saved=1', req.url), 303);
    }

    if (action !== 'delete') return fail('Unsupported review action.', 422);

    const review = await prisma.review.delete({ where: { id } });
    await invalidateCourseCatalogCache();
    await audit({
      actorId: admin.id,
      action: 'review.delete',
      entity: 'review',
      entityId: review.id,
      metadata: { courseId: review.courseId, userId: review.userId, rating: review.rating },
    });

    return NextResponse.redirect(new URL('/admin/reviews?deleted=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Review could not be updated.', 500);
  }
}
