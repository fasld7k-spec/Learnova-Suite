import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { markOrderPaid } from '@/lib/payments';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const orderId = String(form.get('orderId') || '').trim();
    if (!orderId) return fail('Order id is required.', 422);

    await markOrderPaid(orderId, 'manual-admin');
    await audit({
      actorId: admin.id,
      action: 'order.markPaid',
      entity: 'order',
      entityId: orderId,
      metadata: { source: 'manual-admin' },
    });

    return NextResponse.redirect(new URL('/admin/orders', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
