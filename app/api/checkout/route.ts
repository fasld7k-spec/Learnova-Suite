import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { createGatewaySession } from '@/lib/payment-gateways';
import { createOrderForCourse } from '@/lib/payments';
import { appUrlFromRequest } from '@/lib/app-url';
import { verifyCsrf } from '@/lib/csrf';
import { featureEnabled } from '@/lib/features';
import { NextRequest, NextResponse } from 'next/server';
import { checkoutTaxCountry } from '@/lib/order-pricing';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    if (await featureEnabled('checkout_disabled')) return fail('Checkout is temporarily paused.', 503);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const courseId = String(form.get('courseId') || '').trim();
    const gateway = String(form.get('gateway') || 'manual').trim() || 'manual';
    const couponCode = String(form.get('couponCode') || '').trim() || undefined;
    const taxCountry = checkoutTaxCountry(form.get('taxCountry'), req.headers);

    if (!courseId) return fail('Course is required.', 422);

    const order = await createOrderForCourse({
      userId: user.id,
      courseId,
      gateway,
      couponCode,
      taxCountry,
      affiliateCode: req.cookies.get('affiliate_ref')?.value,
    });
    const session = await createGatewaySession(order.id, order.gateway, appUrlFromRequest(req));
    return NextResponse.redirect(session.redirectUrl, 303);
  } catch (error) {
    return handleRouteError(error, req);
  }
}
