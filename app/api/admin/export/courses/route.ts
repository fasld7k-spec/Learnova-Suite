import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const admin = await requireUser(['ADMIN']);
    const courses = await prisma.course.findMany({
      include: {
        instructor: { select: { name: true, email: true } },
        category: { select: { nameEn: true, slug: true } },
        modules: { select: { id: true } },
        enrollments: { select: { id: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await audit({
      actorId: admin.id,
      action: 'export.courses',
      entity: 'course',
      metadata: { count: courses.length },
    });

    return csvResponse(
      `courses-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['id', 'title', 'slug', 'instructor', 'instructorEmail', 'category', 'categorySlug', 'price', 'salePrice', 'status', 'students', 'modules', 'reviews', 'averageRating', 'createdAt', 'updatedAt'],
        courses.map((course) => {
          const ratings = course.reviews.map((review) => review.rating);
          const averageRating = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
          return [
            course.id,
            course.title,
            course.slug,
            course.instructor.name,
            course.instructor.email,
            course.category.nameEn,
            course.category.slug,
            String(course.price),
            String(course.salePrice ?? ''),
            course.status,
            String(course.enrollments.length),
            String(course.modules.length),
            String(course.reviews.length),
            averageRating ? averageRating.toFixed(2) : '',
            course.createdAt.toISOString(),
            course.updatedAt.toISOString(),
          ];
        }),
      ),
    );
  } catch (error: any) {
    return fail(error.message || 'Courses export failed.', 500);
  }
}
