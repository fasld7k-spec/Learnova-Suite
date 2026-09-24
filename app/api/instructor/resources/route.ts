import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { saveCourseResourceFile } from '@/lib/course-upload';
import { verifyCsrf } from '@/lib/csrf';
import { deleteStoredFile } from '@/lib/storage';
import { validateStoredUrl } from '@/lib/url-validation';

function storedUploadKey(url: string) {
  const raw = url.trim();
  if (raw.startsWith('/protected-uploads/') || raw.startsWith('/uploads/')) {
    return raw.replace(/^\/+/, '');
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(f.get('action') || 'create');

    if (action === 'delete') {
      const resource = await prisma.courseResource.findFirst({
        where: { id: String(f.get('resourceId') || ''), courseId: { in: await instructorCourseIds(user.id) } },
      });
      if (!resource) return fail('Resource not found', 404);
      const key = storedUploadKey(resource.url);
      if (key) await deleteStoredFile(key);
      await prisma.courseResource.delete({ where: { id: resource.id } });
      return NextResponse.redirect(new URL('/instructor/resources', req.url), 303);
    }

    const course = await prisma.course.findFirst({ where: { id: String(f.get('courseId')), instructorId: user.id } });
    if (!course) return fail('Course not found', 404);

    const uploadedUrl = await saveCourseResourceFile(f.get('file') as File | null);
    const rawUrl = String(f.get('url') || '').trim();
    const url = uploadedUrl || (rawUrl ? validateStoredUrl(rawUrl, { label: 'Resource URL', allowRelative: true }) : '');

    if (action === 'update') {
      const resource = await prisma.courseResource.findFirst({
        where: { id: String(f.get('resourceId') || ''), courseId: { in: await instructorCourseIds(user.id) } },
      });
      if (!resource) return fail('Resource not found', 404);
      const oldKey = uploadedUrl ? storedUploadKey(resource.url) : null;
      await prisma.courseResource.update({
        where: { id: resource.id },
        data: {
          courseId: course.id,
          title: String(f.get('title') || '').trim(),
          type: String(f.get('type') || resource.type),
          ...(url ? { url } : {}),
        },
      });
      if (oldKey) await deleteStoredFile(oldKey);
      return NextResponse.redirect(new URL('/instructor/resources', req.url), 303);
    }

    if (!url) return fail('Resource URL or file is required', 422);

    await prisma.courseResource.create({
      data: {
        courseId: course.id,
        title: String(f.get('title') || '').trim(),
        url,
        type: String(f.get('type') || 'LINK')
      }
    });
    return NextResponse.redirect(new URL('/instructor/resources', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

async function instructorCourseIds(instructorId: string) {
  const courses = await prisma.course.findMany({ where: { instructorId }, select: { id: true } });
  return courses.map((course) => course.id);
}
