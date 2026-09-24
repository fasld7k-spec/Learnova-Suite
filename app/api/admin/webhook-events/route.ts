import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/webhook-events', req.url), 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || '').trim().toLowerCase();
    const id = String(form.get('id') || '').trim();

    if (action === 'clear-processed') {
      const result = await prisma.webhookEvent.deleteMany({ where: { processed: true } });
      await audit({
        actorId: admin.id,
        action: 'webhookEvent.clearProcessed',
        entity: 'webhookEvent',
        entityId: 'bulk',
        metadata: { count: result.count },
      });
      return redirect(req);
    }

    if (!['toggle', 'delete'].includes(action)) return fail('Unsupported webhook event action.', 422);
    if (!id) return fail('Webhook event id is required.', 422);

    const event = await prisma.webhookEvent.findUnique({ where: { id } });
    if (!event) return fail('Webhook event not found.', 404);

    if (action === 'delete') {
      await prisma.webhookEvent.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: 'webhookEvent.delete',
        entity: 'webhookEvent',
        entityId: id,
        metadata: { provider: event.provider, eventId: event.eventId, processed: event.processed },
      });
      return redirect(req);
    }

    const updated = await prisma.webhookEvent.update({ where: { id }, data: { processed: !event.processed } });
    await audit({
      actorId: admin.id,
      action: 'webhookEvent.toggleProcessed',
      entity: 'webhookEvent',
      entityId: id,
      metadata: { provider: updated.provider, eventId: updated.eventId, processed: updated.processed },
    });

    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Unable to update webhook event.', 500);
  }
}
