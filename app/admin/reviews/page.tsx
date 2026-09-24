import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Reviews(props: { searchParams?: Promise<{ saved?: string; deleted?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const reviews = await prisma.review.findMany({
    include: { user: true, course: true },
    orderBy: { createdAt: 'desc' },
  });
  const enrollments = reviews.length
    ? await prisma.enrollment.findMany({
        where: {
          OR: reviews.map((review) => ({ userId: review.userId, courseId: review.courseId })),
        },
        select: { userId: true, courseId: true },
      })
    : [];
  const verified = new Set(enrollments.map((enrollment) => `${enrollment.userId}:${enrollment.courseId}`));

  return (
    <DashboardShell role="admin" title="Reviews">
      {searchParams?.saved && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Review updated.</div>}
      {searchParams?.deleted && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Review removed.</div>}
      <DataTable
        headers={['Course', 'Student', 'Buyer', 'Rating', 'Comment', 'Date', 'Action']}
        rows={reviews.map((review) => [
          review.course.title,
          review.user.name,
          <Badge key="buyer" tone={verified.has(`${review.userId}:${review.courseId}`) ? 'green' : 'yellow'}>
            {verified.has(`${review.userId}:${review.courseId}`) ? 'Verified buyer' : 'Unverified'}
          </Badge>,
          <span key="rating" className="font-bold text-[#1D9BF0]">{review.rating}/5</span>,
          review.comment || '-',
          review.createdAt.toLocaleDateString(),
          <div key="action" className="grid min-w-80 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit moderation copy</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/reviews" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={review.id} />
                <select className="input" name="rating" defaultValue={String(review.rating)}>
                  {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}
                </select>
                <textarea className="input min-h-24" name="comment" defaultValue={review.comment || ''} />
                <button className="btn-secondary w-fit">Save review</button>
              </form>
            </details>
            <form action="/api/admin/reviews" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={review.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Remove</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
