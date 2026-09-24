import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { automationActions, automationTriggers } from '@/lib/automation';
import { requireUser } from '@/lib/auth';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const triggers = new Set<string>(automationTriggers);
const actions = new Set<string>(automationActions);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/automation-rules', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Automation rule id is required.', 422);
      await prisma.automationRun.deleteMany({ where: { ruleId: id } });
      await prisma.automationRule.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'automation_rule.delete', entity: 'AutomationRule', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Automation rule id is required.', 422);
      const current = await prisma.automationRule.findUnique({ where: { id } });
      if (!current) return fail('Automation rule not found.', 404);
      const next = await prisma.automationRule.update({ where: { id }, data: { active: !current.active } });
      await audit({
        actorId: admin.id,
        action: next.active ? 'automation_rule.enable' : 'automation_rule.disable',
        entity: 'AutomationRule',
        entityId: id,
      });
      return redirect(req);
    }

    const name = value(form, 'name');
    const trigger = value(form, 'trigger');
    const ruleAction = value(form, 'ruleAction') || value(form, 'action');
    if (name.length < 2) return fail('Automation rule name is required.', 422);
    if (!triggers.has(trigger)) return fail('Automation trigger is invalid.', 422);
    if (!actions.has(ruleAction)) return fail('Automation action is invalid.', 422);

    const config = {
      target: value(form, 'target'),
      message: value(form, 'message'),
    };
    const data = {
      name,
      trigger,
      action: ruleAction,
      config: toJson(config),
      active: form.get('active') === 'on',
    };

    if (action === 'update') {
      if (!id) return fail('Automation rule id is required.', 422);
      await prisma.automationRule.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'automation_rule.update', entity: 'AutomationRule', entityId: id });
      return redirect(req);
    }

    const row = await prisma.automationRule.create({ data });
    await audit({ actorId: admin.id, action: 'automation_rule.create', entity: 'AutomationRule', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Automation rule update failed.', 500);
  }
}
