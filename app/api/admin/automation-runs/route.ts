import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { runAutomationRule } from '@/lib/automation';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function redirect(req: NextRequest, params?: Record<string, string>) {
  const url = new URL('/admin/automation-runs', req.url);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || '').trim().toLowerCase();
    const id = String(form.get('id') || '').trim();

    if (action === 'clear-success') {
      const result = await prisma.automationRun.deleteMany({ where: { status: 'SUCCESS' } });
      await audit({
        actorId: admin.id,
        action: 'automationRun.clearSuccess',
        entity: 'automationRun',
        entityId: 'bulk',
        metadata: { count: result.count },
      });
      return redirect(req, { cleared: String(result.count) });
    }

    if (action === 'clear-old') {
      const days = Number(form.get('days') || 30);
      if (!Number.isFinite(days) || days < 7) return fail('Retention must be at least 7 days.', 422);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.automationRun.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await audit({
        actorId: admin.id,
        action: 'automationRun.clearOld',
        entity: 'automationRun',
        entityId: 'bulk',
        metadata: { count: result.count, retentionDays: days },
      });
      return redirect(req, { cleared: String(result.count) });
    }

    if (action === 'run-rule') {
      if (!id) return fail('Automation rule id is required.', 422);
      const rule = await prisma.automationRule.findUnique({ where: { id } });
      if (!rule) return fail('Automation rule not found.', 404);
      const result = await runAutomationRule(rule, {
        userId: admin.id,
        userEmail: admin.email,
        userName: admin.name,
        courseTitle: 'Manual automation test',
        ticketSubject: 'Manual automation test',
      });
      await audit({
        actorId: admin.id,
        action: 'automationRun.manualRun',
        entity: 'automationRule',
        entityId: rule.id,
        metadata: { status: result.status, message: result.message },
      });
      return redirect(req, { ran: result.status });
    }

    if (action === 'retry') {
      if (!id) return fail('Automation run id is required.', 422);
      const run = await prisma.automationRun.findUnique({ where: { id } });
      if (!run) return fail('Automation run not found.', 404);
      const rule = await prisma.automationRule.findUnique({ where: { id: run.ruleId } });
      if (!rule) return fail('Automation rule no longer exists.', 404);
      const result = await runAutomationRule(rule, {
        userId: admin.id,
        userEmail: admin.email,
        userName: admin.name,
        courseTitle: 'Manual automation retry',
        ticketSubject: 'Manual automation retry',
      });
      await audit({
        actorId: admin.id,
        action: 'automationRun.retry',
        entity: 'automationRun',
        entityId: id,
        metadata: { ruleId: rule.id, status: result.status, message: result.message },
      });
      return redirect(req, { retried: result.status });
    }

    if (action !== 'delete') return fail('Unsupported automation run action.', 422);
    if (!id) return fail('Automation run id is required.', 422);

    const run = await prisma.automationRun.findUnique({ where: { id } });
    if (!run) return fail('Automation run not found.', 404);

    await prisma.automationRun.delete({ where: { id } });
    await audit({
      actorId: admin.id,
      action: 'automationRun.delete',
      entity: 'automationRun',
      entityId: id,
      metadata: { ruleId: run.ruleId, status: run.status },
    });

    return redirect(req, { deleted: '1' });
  } catch (error: any) {
    return fail(error.message || 'Unable to update automation runs.', 500);
  }
}
