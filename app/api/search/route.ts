import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/api';

const durationRanges: Record<string, { lt?: number; lte?: number; gt?: number; gte?: number }> = {
  short: { lt: 180 },
  medium: { gte: 180, lte: 480 },
  long: { gt: 480 },
};

function averageRating(course: { reviews: { rating: number }[] }) {
  if (!course.reviews.length) return 0;
  return course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get('q')?.trim() || '';
  const minRating = Number(params.get('rating') || 0);
  const where: any = { status: 'PUBLISHED' };

  if (q.length >= 2) {
    where.OR = [
      { title: { contains: q } },
      { shortDescription: { contains: q } },
      { fullDescription: { contains: q } },
      { category: { nameEn: { contains: q } } },
    ];
  }
  if (params.get('category')) where.categoryId = params.get('category');
  if (params.get('level')) where.level = params.get('level');
  if (params.get('language')) where.language = params.get('language');
  if (params.get('certificate') === 'yes') where.includesCertificate = true;
  if (params.get('certificate') === 'no') where.includesCertificate = false;
  const duration = params.get('duration');
  if (duration && durationRanges[duration]) where.durationMinutes = durationRanges[duration];

  const [courses, categories, facets] = await Promise.all([
    prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        level: true,
        language: true,
        durationMinutes: true,
        includesCertificate: true,
        category: { select: { id: true, nameEn: true, nameAr: true, slug: true } },
        instructor: { select: { id: true, name: true, avatar: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    q.length >= 2
      ? prisma.category.findMany({
          where: { OR: [{ nameEn: { contains: q } }, { nameAr: { contains: q } }] },
          select: { id: true, nameEn: true, nameAr: true, slug: true },
          orderBy: { nameEn: 'asc' },
          take: 6,
        })
      : prisma.category.findMany({ select: { id: true, nameEn: true, nameAr: true, slug: true }, orderBy: { nameEn: 'asc' }, take: 6 }),
    prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: { level: true, language: true, includesCertificate: true, durationMinutes: true },
    }),
  ]);

  const filteredCourses = courses
    .filter((course) => !minRating || averageRating(course) >= minRating)
    .map((course) => ({
      id: course.id,
      title: course.title,
      slug: course.slug,
      shortDescription: course.shortDescription,
      level: course.level,
      language: course.language,
      durationMinutes: course.durationMinutes,
      includesCertificate: course.includesCertificate,
      category: course.category ? { id: course.category.id, nameEn: course.category.nameEn, slug: course.category.slug } : null,
      instructor: course.instructor ? { id: course.instructor.id, name: course.instructor.name } : null,
      rating: averageRating(course),
    }));

  return ok({
    courses: filteredCourses,
    categories,
    filters: {
      levels: [...new Set(facets.map((course) => course.level).filter(Boolean))],
      languages: [...new Set(facets.map((course) => course.language).filter(Boolean))],
      certificates: [...new Set(facets.map((course) => course.includesCertificate))],
      durations: ['short', 'medium', 'long'],
      ratings: [4, 3, 2],
      sorts: ['newest', 'rating', 'duration-asc', 'duration-desc', 'price-asc', 'price-desc'],
    },
  });
}
