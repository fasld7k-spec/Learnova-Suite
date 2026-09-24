import { NextRequest } from 'next/server';
import { ok, handleError, fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

async function readFavoritePayload(req: NextRequest) {
  const headerToken = req.headers.get('x-csrf-token') || '';
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return {
      courseId: typeof body.courseId === 'string' ? body.courseId : '',
      csrfToken: headerToken || (typeof body.csrfToken === 'string' ? body.csrfToken : ''),
    };
  }

  const form = await req.formData().catch(() => null);
  return {
    courseId: typeof form?.get('courseId') === 'string' ? String(form.get('courseId')) : '',
    csrfToken: headerToken || String(form?.get('csrfToken') || ''),
  };
}

export async function GET() {
  try {
    const user = await requireUser(['STUDENT']);
    const favorites = await prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const courses = favorites.length
      ? await prisma.course.findMany({
          where: { id: { in: favorites.map((favorite) => favorite.courseId) } },
          select: {
            id: true,
            title: true,
            slug: true,
            shortDescription: true,
            coverImage: true,
            price: true,
            salePrice: true,
            level: true,
            language: true,
            durationMinutes: true,
            isFree: true,
            includesCertificate: true,
            category: { select: { id: true, nameEn: true, nameAr: true, slug: true } },
            instructor: { select: { id: true, name: true, avatar: true } },
          },
        })
      : [];

    return ok({ favorites, courses });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const { courseId, csrfToken } = await readFavoritePayload(req);
    if (!(await verifyCsrf(csrfToken))) return fail('Invalid CSRF token.', 403);
    if (!courseId) return fail('courseId is required', 422);

    const course = await prisma.course.findFirst({ where: { id: courseId, status: 'PUBLISHED' }, select: { id: true } });
    if (!course) return fail('Course not found', 404);

    const favorite = await prisma.favorite.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      update: {},
      create: { userId: user.id, courseId }
    });

    return ok(favorite, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const queryCourseId = req.nextUrl.searchParams.get('courseId');
    const queryToken = req.headers.get('x-csrf-token') || req.nextUrl.searchParams.get('csrfToken') || '';
    const payload = queryCourseId ? { courseId: queryCourseId, csrfToken: queryToken } : await readFavoritePayload(req);
    if (!(await verifyCsrf(payload.csrfToken))) return fail('Invalid CSRF token.', 403);
    const courseId = payload.courseId;
    if (!courseId) return fail('courseId is required', 422);

    await prisma.favorite.deleteMany({ where: { userId: user.id, courseId } });
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
