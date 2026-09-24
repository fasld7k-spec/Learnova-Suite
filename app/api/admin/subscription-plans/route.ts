import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { toList } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function lines(v: FormDataEntryValue | null) {
  return String(v || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/subscription-plans', req.url), 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(f.get('_action') || 'save');

    if (action === 'status') {
      const id = String(f.get('id') || '');
      if (!id) return fail('Plan id is required', 422);

      const plan = await prisma.subscriptionPlan.update({
        where: { id },
        data: { active: String(f.get('active')) === 'true' },
      });
      await audit({ actorId: admin.id, action: plan.active ? 'subscription_plan.enable' : 'subscription_plan.disable', entity: 'SubscriptionPlan', entityId: plan.id, metadata: { slug: plan.slug } });
      return redirect(req);
    }

    if (action === 'delete') {
      const id = String(f.get('id') || '');
      if (!id) return fail('Plan id is required', 422);

      const subscriptionCount = await prisma.subscription.count({ where: { planId: id } });
      if (subscriptionCount > 0) return fail('Plans with subscriptions cannot be deleted. Disable the plan instead.', 409);

      const plan = await prisma.subscriptionPlan.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'subscription_plan.delete', entity: 'SubscriptionPlan', entityId: plan.id, metadata: { slug: plan.slug } });
      return redirect(req);
    }

    const name = String(f.get('name') || '').trim();
    const slug = String(f.get('slug') || '').trim();
    const price = Number(f.get('price') || 0);
    const interval = String(f.get('interval') || 'monthly');

    if (!name) return fail('Plan name is required', 422);
    if (!slug) return fail('Plan slug is required', 422);
    if (!Number.isFinite(price) || price < 0) return fail('Plan price must be zero or greater', 422);
    if (!['monthly', 'yearly'].includes(interval)) return fail('Plan interval must be monthly or yearly', 422);

    const existing = await prisma.subscriptionPlan.findUnique({ where: { slug } });
    const plan = await prisma.subscriptionPlan.upsert({
      where: { slug },
      update: {
        name,
        price,
        interval,
        features: toList(lines(f.get('features'))),
        active: f.get('active') === 'on',
      },
      create: {
        name,
        slug,
        price,
        interval,
        features: toList(lines(f.get('features'))),
        active: f.get('active') === 'on',
      },
    });
    await audit({ actorId: admin.id, action: existing ? 'subscription_plan.update' : 'subscription_plan.create', entity: 'SubscriptionPlan', entityId: plan.id, metadata: { slug, interval, price } });
    return redirect(req);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
