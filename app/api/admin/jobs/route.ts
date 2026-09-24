import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { enqueue, runDueJobs } from '@/lib/jobs';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'enqueue');

    if (action === 'run') {
      const results = await runDueJobs(25);
      await audit({
        actorId: admin.id,
        action: 'job_queue.run_due',
        entity: 'JobQueue',
        metadata: { processed: results.length, statuses: results.map((result) => result.status) },
      });
      return NextResponse.redirect(new URL('/admin/jobs?ran=1', req.url), 303);
    }

    if (action === 'retry') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('Job id is required', 422);
      await prisma.jobQueue.update({ where: { id }, data: { status: 'PENDING', attempts: 0, lastError: null, runAt: new Date() } });
      await audit({ actorId: admin.id, action: 'job_queue.retry', entity: 'JobQueue', entityId: id });
      return NextResponse.redirect(new URL('/admin/jobs?retried=1', req.url), 303);
    }

    if (action === 'delete') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('Job id is required', 422);
      await prisma.jobQueue.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'job_queue.delete', entity: 'JobQueue', entityId: id });
      return NextResponse.redirect(new URL('/admin/jobs?deleted=1', req.url), 303);
    }

    if (action === 'purge_done') {
      const result = await prisma.jobQueue.deleteMany({ where: { status: 'DONE' } });
      await audit({ actorId: admin.id, action: 'job_queue.purge_done', entity: 'JobQueue', metadata: { deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/jobs?purged=1', req.url), 303);
    }

    const payload = {
      recipient: String(form.get('recipient') || ''),
      subject: String(form.get('subject') || ''),
      body: String(form.get('body') || ''),
      role: String(form.get('role') || ''),
      days: String(form.get('days') || ''),
    };

    const type = String(form.get('type') || '').trim();
    if (!type) return fail('Job type is required', 422);

    const job = await enqueue(type, payload);
    await audit({
      actorId: admin.id,
      action: 'job_queue.enqueue',
      entity: 'JobQueue',
      entityId: job.id,
      metadata: { type },
    });
    return NextResponse.redirect(new URL('/admin/jobs?queued=1', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
