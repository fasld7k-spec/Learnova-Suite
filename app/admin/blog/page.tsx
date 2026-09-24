import { CalendarDays, FileText, PencilLine, Radio } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function BlogAdmin() {
  await requireUser(['ADMIN']);
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
  const published = posts.filter((post) => post.published).length;
  const drafts = posts.length - published;
  const withCover = posts.filter((post) => post.coverImage).length;

  return (
    <DashboardShell role="admin" title="Blog">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Posts" value={posts.length} icon={<FileText size={18} />} />
        <StatCard label="Published" value={published} icon={<Radio size={18} />} />
        <StatCard label="Drafts" value={drafts} icon={<PencilLine size={18} />} />
        <StatCard label="With cover" value={withCover} icon={<CalendarDays size={18} />} />
      </div>

      <div className="mt-6 grid gap-4 2xl:grid-cols-[420px_1fr]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/blog" method="post">
          <CsrfInput />
          <h2 className="text-lg font-black text-white">Create Editorial Post</h2>
          <p className="mt-1 text-sm font-semibold text-[#71767B]">Use posts for product updates, learning guides, instructor interviews and SEO content.</p>
          <div className="mt-5 grid gap-3">
            <input className="input" name="title" placeholder="How to plan a cohort-based course" required />
            <input className="input" name="slug" placeholder="plan-cohort-based-course" required />
            <input className="input" name="coverImage" placeholder="Cover image URL or /path" />
            <textarea className="input min-h-24" name="excerpt" placeholder="Short excerpt for listing cards and SEO previews" required />
            <textarea className="input min-h-44" name="content" placeholder="Post content" required />
            <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]">
              <input type="checkbox" name="published" /> Published
            </label>
            <button className="btn-primary w-fit">Save Post</button>
          </div>
        </form>

        <section>
          <h2 className="text-lg font-black text-white">Editorial Calendar</h2>
          <p className="mb-3 mt-1 text-sm font-semibold text-[#71767B]">Show reviewers and buyers that CMS content can be drafted, published and used for acquisition.</p>
          <DataTable
            headers={['Post', 'Slug', 'Status', 'Quality', 'Date', 'Manage']}
            rows={posts.map((post) => [
              <div key="post" className="min-w-[240px]">
                <p className="font-bold text-white">{post.title}</p>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#71767B]">{post.excerpt}</p>
              </div>,
              <code key="slug" className="text-xs font-bold text-[#1D9BF0]">{post.slug}</code>,
              <Badge key="published" tone={post.published ? 'green' : 'yellow'}>{post.published ? 'Published' : 'Draft'}</Badge>,
              <Badge key="quality" tone={post.content.length > 240 ? 'green' : 'yellow'}>{post.content.length > 240 ? 'Detailed' : 'Short'}</Badge>,
              post.createdAt.toLocaleDateString(),
              <div key="manage" className="grid min-w-96 gap-2">
                <form className="grid gap-2" action="/api/admin/blog" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="update" />
                  <input type="hidden" name="id" value={post.id} />
                  <input className="input" name="title" defaultValue={post.title} />
                  <input className="input" name="slug" defaultValue={post.slug} />
                  <input className="input" name="coverImage" defaultValue={post.coverImage || ''} />
                  <textarea className="input min-h-24" name="excerpt" defaultValue={post.excerpt} />
                  <textarea className="input min-h-36" name="content" defaultValue={post.content} />
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <input type="checkbox" name="published" defaultChecked={post.published} /> Published
                  </label>
                  <button className="btn-secondary w-fit">Update</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <form action="/api/admin/blog" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="toggle" />
                    <input type="hidden" name="id" value={post.id} />
                    <button className="btn-secondary">{post.published ? 'Unpublish' : 'Publish'}</button>
                  </form>
                  <form action="/api/admin/blog" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="id" value={post.id} />
                    <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                  </form>
                </div>
              </div>
            ])}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
