import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/api';
import { recordApiUsage, requireApiKey } from '@/lib/api-key';

const durationRanges: Record<string, { lt?: number; lte?: number; gt?: number; gte?: number }> = {
  short: { lt: 180 },
  medium: { gte: 180, lte: 480 },
  long: { gt: 480 },
};

function averageRating(course: { reviews: { rating: number }[] }) {
  if (!course.reviews.length) return 0;
  return course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length;
}

function price(course: { isFree: boolean; salePrice: any; price: any }) {
  if (course.isFree) return 0;
  return Number(course.salePrice ?? course.price ?? 0);
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req, 'courses:read');
  if (!auth.ok) return auth.response;

  const params = req.nextUrl.searchParams;
  const q = params.get('q')?.trim() || '';
  const minRating = Number(params.get('rating') || 0);
  const where: any = { status: 'PUBLISHED' };

  if (q) {
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

  const courses = await prisma.course.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      salePrice: true,
      level: true,
      language: true,
      durationMinutes: true,
      isFree: true,
      includesCertificate: true,
      category: { select: { id: true, nameEn: true, nameAr: true, slug: true } },
      reviews: { select: { rating: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const sortedCourses = courses
    .filter((course) => !minRating || averageRating(course) >= minRating)
    .sort((a, b) => {
      if (params.get('sort') === 'rating') return averageRating(b) - averageRating(a);
      if (params.get('sort') === 'duration-asc') return a.durationMinutes - b.durationMinutes;
      if (params.get('sort') === 'duration-desc') return b.durationMinutes - a.durationMinutes;
      if (params.get('sort') === 'price-asc') return price(a) - price(b);
      if (params.get('sort') === 'price-desc') return price(b) - price(a);
      return 0;
    })
    .map((course) => ({
      id: course.id,
      title: course.title,
      slug: course.slug,
      price: course.price,
      salePrice: course.salePrice,
      level: course.level,
      language: course.language,
      durationMinutes: course.durationMinutes,
      includesCertificate: course.includesCertificate,
      rating: averageRating(course),
      category: course.category ? { id: course.category.id, nameEn: course.category.nameEn, slug: course.category.slug } : null,
    }));

  await recordApiUsage({ apiKeyId: auth.apiKey.id, req, status: 200 });
  return ok(sortedCourses);
}
