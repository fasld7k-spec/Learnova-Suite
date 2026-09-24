import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function InstructorReviews() {
  await requireUser(['ADMIN']);
  const reviews = await prisma.instructorReview.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const people = reviews.length
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(new Set(reviews.flatMap((review) => [review.instructorId, review.userId]))) } },
      })
    : [];
  const names = new Map(people.map((person) => [person.id, person.name]));

  return (
    <DashboardShell role="admin" title="Instructor Reviews">
      <DataTable
        headers={['Instructor', 'Student', 'Rating', 'Comment', 'Date', 'Action']}
        rows={reviews.map((review) => [
          names.get(review.instructorId) || 'Instructor',
          names.get(review.userId) || 'Student',
          review.rating,
          review.comment || '-',
          review.createdAt.toLocaleDateString(),
          <form key="action" action="/api/admin/instructor-reviews" method="post">
          <CsrfInput />
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={review.id} />
            <button className="btn-secondary border-red-400/40 text-red-200">Remove</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
