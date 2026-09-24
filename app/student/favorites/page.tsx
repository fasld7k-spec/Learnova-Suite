import { ArrowRight, Heart, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState } from '@/components/EmptyState';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

const money = (value: unknown) => Number(value || 0).toFixed(2);

export default async function Favorites(props: { searchParams?: Promise<{ collectionSaved?: string; collectionDeleted?: string }> }) {
  const user = await requireUser(['STUDENT']);
  const [favorites, collections, searchParams] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.wishlistCollection.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    props.searchParams,
  ]);
  const courses = favorites.length
    ? await prisma.course.findMany({
        where: { id: { in: favorites.map((favorite) => favorite.courseId) }, status: 'PUBLISHED' },
        include: { category: true, instructor: true }
      })
    : [];
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const orderedCourses = favorites.map((favorite) => courseById.get(favorite.courseId)).filter(Boolean);
  const saleCount = orderedCourses.filter((course) => course?.salePrice).length;

  return (
    <DashboardShell role="student" title="Favorites">
      {searchParams?.collectionSaved ? <p className="mb-4 border border-[#00BA7C]/40 bg-[#00BA7C]/10 p-3 text-sm font-bold text-[#D7FBE8]">Wishlist collection saved.</p> : null}
      {searchParams?.collectionDeleted ? <p className="mb-4 border border-[#00BA7C]/40 bg-[#00BA7C]/10 p-3 text-sm font-bold text-[#D7FBE8]">Wishlist collection deleted.</p> : null}
      <section className="grid gap-4 border border-[#2F3336] bg-[#050505] p-5 md:grid-cols-3">
        <div>
          <p className="text-sm font-bold text-[#1D9BF0]">Saved courses</p>
          <b className="mt-2 block text-3xl font-black">{orderedCourses.length}</b>
        </div>
        <div>
          <p className="text-sm font-bold text-[#1D9BF0]">Seasonal deals</p>
          <b className="mt-2 block text-3xl font-black">{saleCount}</b>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-[#71767B]">
          <Heart size={20} className="text-rose-400" />
          Use favorites to shortlist courses before buying a bundle or plan.
        </div>
      </section>

      {orderedCourses.length ? (
        <section className="mt-6 border border-[#2F3336] bg-black p-5">
          <h2 className="text-xl font-black text-white">Wishlist collections</h2>
          <p className="mt-2 text-sm font-semibold text-[#71767B]">Group favorite courses into shortlists for future purchases or bundles.</p>
          <form className="mt-4 grid gap-3" action="/api/student/wishlist-collections" method="post">
            <CsrfInput />
            <input className="input" name="title" placeholder="Collection title" required />
            <div className="grid gap-2 md:grid-cols-2">
              {orderedCourses.map((course) => course ? (
                <label className="flex items-center gap-2 rounded-lg border border-[#2F3336] p-3 text-sm font-bold text-[#E7E9EA]" key={course.id}>
                  <input type="checkbox" name="courseIds" value={course.id} />
                  {course.title}
                </label>
              ) : null)}
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
              <input type="checkbox" name="public" />
              Public shareable shortlist
            </label>
            <button className="btn-primary w-fit">Save collection</button>
          </form>
          {collections.length ? (
            <div className="mt-5 grid gap-3">
              {collections.map((collection) => {
                const ids = fromJsonArray<string>(collection.courseIds);
                const titles = ids.map((id) => courseById.get(id)?.title).filter(Boolean);
                return (
                  <article className="border border-[#2F3336] p-4" key={collection.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-white">{collection.title}</h3>
                        <p className="mt-1 text-sm text-[#71767B]">{titles.length ? titles.join(', ') : 'No favorite courses selected'}</p>
                      </div>
                      <form action="/api/student/wishlist-collections" method="post">
                        <CsrfInput />
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={collection.id} />
                        <button className="btn-secondary text-xs">Delete</button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {orderedCourses.length ? (
        <div className="mt-6 grid gap-4">
          {orderedCourses.map((course) => {
            if (!course) return null;
            const salePrice = course.salePrice ? Number(course.salePrice) : null;
            const regularPrice = Number(course.price || 0);

            return (
              <article className="grid gap-5 border-b border-[#2F3336] py-5 md:grid-cols-[1fr_auto]" key={course.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#1D9BF0]/10 px-3 py-1 text-xs font-black text-[#1D9BF0]">
                      {course.category?.nameEn || 'Course'}
                    </span>
                    {salePrice !== null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                        <Tag size={13} />
                        Seasonal offer
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-black">{course.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">{course.shortDescription}</p>
                  <p className="mt-3 text-sm font-semibold text-[#71767B]">Instructor: {course.instructor?.name || 'Learnova instructor'}</p>
                </div>

                <div className="flex flex-col justify-between gap-4 md:min-w-56 md:items-end">
                  <div className="text-left md:text-right">
                    {salePrice !== null && <p className="text-sm font-bold text-[#71767B] line-through">${money(regularPrice)}</p>}
                    <p className="text-3xl font-black text-white">{course.isFree ? 'Free' : `$${money(salePrice ?? regularPrice)}`}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a className="btn-primary" href={`/courses/${course.slug}`}>
                      View
                      <ArrowRight size={16} />
                    </a>
                    <form action="/api/favorites/toggle" method="post">
                      <CsrfInput />
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="redirect" value="/student/favorites" />
                      <button className="btn-secondary" type="submit">
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No favorites yet"
            description="Browse published courses and save the ones you want to compare later."
            action={
              <a className="btn-primary" href="/courses">
                <ShoppingBag size={17} />
                Browse courses
              </a>
            }
          />
        </div>
      )}
    </DashboardShell>
  );
}
