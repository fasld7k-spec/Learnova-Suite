import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { processCourseImportJob } from '@/lib/course-transfer';
import { verifyCsrf } from '@/lib/csrf';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

const sources = new Set(['csv', 'backup', 'json']);
const maxImportSize = 10 * 1024 * 1024;

function formValue(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function persistImportFile(file: File) {
  if (!file.size) return null;
  if (file.size > maxImportSize) throw new Error('Import file must be 10MB or smaller.');

  const originalName = file.name || 'course-import';
  const ext = path.extname(originalName).toLowerCase();
  if (!['.csv', '.json', '.txt'].includes(ext)) {
    throw new Error('Import file must be a CSV, JSON, or TXT file.');
  }

  const dir = path.join(process.cwd(), 'public', 'imports');
  await mkdir(dir, { recursive: true });
  const safeName = `course-import-${Date.now()}-${randomUUID()}${ext}`;
  const absolute = path.join(dir, safeName);
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return {
    fileUrl: `/imports/${safeName}`,
    originalName,
    size: file.size,
  };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = formValue(form, '_action') || 'create';

    if (action === 'retry') {
      const jobId = formValue(form, 'jobId');
      if (!jobId) return fail('Import job is required.', 422);
      const job = await prisma.courseImportJob.findUnique({ where: { id: jobId } });
      if (!job) return fail('Import job not found.', 404);
      await prisma.courseImportJob.update({ where: { id: jobId }, data: { status: 'PENDING' } });
      await processCourseImportJob(jobId, admin.id);
      await audit({ actorId: admin.id, action: 'course_import.retry', entity: 'CourseImportJob', entityId: jobId });
      return NextResponse.redirect(new URL('/admin/course-import-export?importRetried=1', req.url), 303);
    }

    if (action === 'delete') {
      const jobId = formValue(form, 'jobId');
      if (!jobId) return fail('Import job is required.', 422);
      await prisma.courseImportJob.delete({ where: { id: jobId } });
      await audit({ actorId: admin.id, action: 'course_import.delete', entity: 'CourseImportJob', entityId: jobId });
      return NextResponse.redirect(new URL('/admin/course-import-export?importDeleted=1', req.url), 303);
    }

    if (action === 'purge_old') {
      const days = Math.max(1, Number(formValue(form, 'days') || 30));
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.courseImportJob.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await audit({ actorId: admin.id, action: 'course_import.purge_old', entity: 'CourseImportJob', metadata: { days, deleted: result.count } });
      return NextResponse.redirect(new URL(`/admin/course-import-export?importPurged=${result.count}`, req.url), 303);
    }

    if (action !== 'create') return fail('Unsupported import action.', 422);

    const source = formValue(form, 'source').toLowerCase() || 'json';
    const uploadedFile = form.get('file');
    const storedFile = uploadedFile instanceof File ? await persistImportFile(uploadedFile) : null;
    const fileUrl = storedFile?.fileUrl || formValue(form, 'fileUrl');
    if (!sources.has(source)) return fail('Unsupported import source.', 422);
    if (!fileUrl) return fail('Import file URL is required.', 422);

    const payload = {
      title: formValue(form, 'title'),
      fileUrl,
      uploadedFile: storedFile,
      notes: formValue(form, 'notes'),
    };
    const job = await prisma.courseImportJob.create({
      data: { source, payload: toJson(payload), status: 'PENDING' },
    });
    await processCourseImportJob(job.id, admin.id);
    await audit({ actorId: admin.id, action: 'course_import.create', entity: 'CourseImportJob', entityId: job.id, metadata: { source, fileUrl } });
    return NextResponse.redirect(new URL('/admin/course-import-export?imported=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Course import failed.', 500);
  }
}
