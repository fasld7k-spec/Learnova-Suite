import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { retryWebhookDelivery } from '@/lib/outbound-webhooks';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    if (!id) return fail('Delivery ID is required.', 422);
    await retryWebhookDelivery(id);
    await audit({ actorId: admin.id, action: 'webhook_delivery.retry', entity: 'webhookDelivery', entityId: id });
    return NextResponse.redirect(new URL('/admin/webhook-deliveries?retried=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message, /required|not found|disabled/i.test(error.message) ? 422 : 500);
  }
}
