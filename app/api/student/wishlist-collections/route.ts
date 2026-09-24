import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { toList } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create');
    const id = String(form.get('id') || '').trim();

    if (action === 'delete') {
      if (!id) return fail('Collection id is required.', 422);
      await prisma.wishlistCollection.deleteMany({ where: { id, userId: user.id } });
      return NextResponse.redirect(new URL('/student/favorites?collectionDeleted=1', req.url), 303);
    }

    const title = String(form.get('title') || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const courseIds = form.getAll('courseIds').map(String).filter(Boolean);
    if (!title) return fail('Collection title is required.', 422);

    const favoriteCount = courseIds.length
      ? await prisma.favorite.count({ where: { userId: user.id, courseId: { in: courseIds } } })
      : 0;
    if (favoriteCount !== courseIds.length) return fail('Only favorited courses can be added to wishlist collections.', 403);

    await prisma.wishlistCollection.create({
      data: {
        userId: user.id,
        title,
        courseIds: toList(courseIds),
        public: form.get('public') === 'on',
      },
    });
    return NextResponse.redirect(new URL('/student/favorites?collectionSaved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Wishlist collection update failed.', 500);
  }
}
