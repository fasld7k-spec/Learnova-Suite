import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const allowedApplicationStatuses = new Set(['APPLIED', 'SHORTLISTED', 'REJECTED', 'HIRED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/jobs-board', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function validateUrl(value: string) {
  if (!value) return '';
  if (value.startsWith('/')) return value;
  try {
    return new URL(value).toString();
  } catch {
    throw new Error('Apply URL must be an absolute URL or an internal path.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'application-status') {
      const applicationId = value(form, 'applicationId');
      const status = value(form, 'status').toUpperCase();
      if (!applicationId) return fail('Application id is required.', 422);
      if (!allowedApplicationStatuses.has(status)) return fail('Invalid application status.', 422);
      const application = await prisma.jobApplication.update({ where: { id: applicationId }, data: { status } });
      await audit({ actorId: admin.id, action: 'job_application.status', entity: 'JobApplication', entityId: applicationId, metadata: { status } });
      await prisma.notification.create({
        data: {
          userId: application.userId,
          title: 'Job application updated',
          body: `Your job application status changed to ${status}.`,
        },
      }).catch(() => null);
      return redirect(req);
    }

    if (action === 'delete') {
      if (!id) return fail('Job id is required.', 422);
      await prisma.jobApplication.deleteMany({ where: { jobId: id } });
      await prisma.jobBoardPost.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'job_board_post.delete', entity: 'JobBoardPost', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Job id is required.', 422);
      const current = await prisma.jobBoardPost.findUnique({ where: { id } });
      if (!current) return fail('Job post not found.', 404);
      const job = await prisma.jobBoardPost.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: job.active ? 'job_board_post.enable' : 'job_board_post.disable', entity: 'JobBoardPost', entityId: id });
      return redirect(req);
    }

    const title = value(form, 'title');
    const company = value(form, 'company');
    const location = value(form, 'location');
    const url = validateUrl(value(form, 'url'));
    const description = value(form, 'description');
    if (title.length < 3) return fail('Job title must be at least 3 characters.', 422);
    if (company.length < 2) return fail('Company is required.', 422);
    if (description.length < 20) return fail('Description must be at least 20 characters.', 422);

    const data = { title, company, location, url, description, active: form.get('active') === 'on' };
    if (action === 'update') {
      if (!id) return fail('Job id is required.', 422);
      await prisma.jobBoardPost.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'job_board_post.update', entity: 'JobBoardPost', entityId: id });
      return redirect(req);
    }

    const job = await prisma.jobBoardPost.create({ data });
    await audit({ actorId: admin.id, action: 'job_board_post.create', entity: 'JobBoardPost', entityId: job.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Job board update failed.', 500);
  }
}
