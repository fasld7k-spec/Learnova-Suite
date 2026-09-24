import { requireUser } from '@/lib/auth';
import { CsrfInput } from '@/components/CsrfInput';
import { FileUploadLabel } from '@/components/instructor/FileUploadLabel';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { createCourseResourceAccessUrl } from '@/lib/content-protection';

export default async function Resources() {
  const user = await requireUser(['INSTRUCTOR']);
  const courses = await prisma.course.findMany({ where: { instructorId: user.id }, orderBy: { title: 'asc' } });
  const rows = await prisma.courseResource.findMany({ where: { courseId: { in: courses.map((course) => course.id) } }, orderBy: { createdAt: 'desc' } });
  const protectedRows = await Promise.all(rows.map(async (resource) => ({
    ...resource,
    accessUrl: await createCourseResourceAccessUrl({
      userId: user.id,
      courseId: resource.courseId,
      resourceId: resource.id,
      url: resource.url
    })
  })));
  const courseNames = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="instructor" title="Course Resources">
      <form className="border border-[#2F3336] bg-black p-5" action="/api/instructor/resources" method="post" encType="multipart/form-data">
        <CsrfInput />
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Add course resource</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Upload a PDF, ZIP, image, or MP4 resource, or paste an external protected link.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="input" name="courseId" required>
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <select className="input" name="type" defaultValue="PDF">
            <option>LINK</option>
            <option>PDF</option>
            <option>ZIP</option>
            <option>VIDEO</option>
            <option>IMAGE</option>
          </select>
          <input className="input" name="title" placeholder="Resource title" required />
          <input className="input" name="url" placeholder="External resource URL, optional if uploading a file" />
        </div>
        <div className="mt-4">
          <FileUploadLabel
            name="file"
            accept="application/pdf,application/zip,application/x-zip-compressed,video/mp4,image/png,image/jpeg,image/webp"
            title="Upload resource file"
            hint="PDF, ZIP, MP4, PNG, JPG, or WEBP. Max 500MB."
          />
        </div>
        <button className="btn-primary mt-4 w-fit">Add Resource</button>
      </form>

      <div className="mt-6">
        <DataTable
          headers={['Title', 'Course', 'Type', 'URL', 'Created', 'Manage']}
          rows={protectedRows.map((resource) => [
            resource.title,
            courseNames.get(resource.courseId) || 'Course',
            resource.type,
            resource.accessUrl ? <a key="u" className="text-[#1D9BF0]" href={resource.accessUrl} target="_blank" rel="noreferrer">Open protected</a> : 'Unavailable',
            resource.createdAt.toLocaleDateString(),
            <div key="manage" className="grid min-w-72 gap-2">
              <form className="grid gap-2" action="/api/instructor/resources" method="post" encType="multipart/form-data">
                <CsrfInput />
                <input type="hidden" name="action" value="update" />
                <input type="hidden" name="resourceId" value={resource.id} />
                <select className="input" name="courseId" defaultValue={resource.courseId} required>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
                <select className="input" name="type" defaultValue={resource.type}>
                  <option>LINK</option>
                  <option>PDF</option>
                  <option>ZIP</option>
                  <option>VIDEO</option>
                  <option>IMAGE</option>
                </select>
                <input className="input" name="title" defaultValue={resource.title} aria-label="Resource title" required />
                <input className="input" name="url" defaultValue={resource.url} aria-label="Resource URL" />
                <FileUploadLabel
                  name="file"
                  accept="application/pdf,application/zip,application/x-zip-compressed,video/mp4,image/png,image/jpeg,image/webp"
                  title="Replace file"
                  hint="Leave empty to keep current URL."
                />
                <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-white hover:bg-[#16181C]">Update</button>
              </form>
              <form action="/api/instructor/resources" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="resourceId" value={resource.id} />
                <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">Delete</button>
              </form>
            </div>
          ])}
        />
      </div>
    </DashboardShell>
  );
}
