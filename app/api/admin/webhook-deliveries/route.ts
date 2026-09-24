import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function olderThan(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();

    if (action === 'purge-old') {
      const days = Math.max(1, Math.round(Number(form.get('days') || 90)));
      const result = await prisma.webhookDelivery.deleteMany({ where: { createdAt: { lt: olderThan(days) } } });
      await audit({ actorId: admin.id, action: 'webhook_delivery.purge_old', entity: 'webhookDelivery', metadata: { days, deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/webhook-deliveries?purged=1', req.url), 303);
    }

    if (action === 'delete') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('Webhook delivery ID is required.', 422);
      const delivery = await prisma.webhookDelivery.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: 'webhook_delivery.delete',
        entity: 'webhookDelivery',
        entityId: delivery.id,
        metadata: { endpointId: delivery.endpointId, event: delivery.event, status: delivery.status },
      });
      return NextResponse.redirect(new URL('/admin/webhook-deliveries?deleted=1', req.url), 303);
    }

    return fail('Unsupported webhook delivery action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Webhook delivery action failed.', 500);
  }
}
