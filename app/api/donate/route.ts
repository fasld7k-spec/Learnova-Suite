import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { appUrlFromRequest } from '@/lib/app-url';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { createGatewaySession } from '@/lib/payment-gateways';
import { createOrderForDonation } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, 'public.donate', 20, 10 * 60_000);
    if (limited) return limited;

    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const campaignId = String(form.get('campaignId') || '').trim();
    const amount = Number(form.get('amount') || 0);
    const gateway = String(form.get('gateway') || 'manual').trim() || 'manual';
    const donorName = String(form.get('donorName') || '').trim();
    const message = String(form.get('message') || '').trim();

    if (!campaignId) return fail('Donation campaign is required.', 422);
    if (!Number.isFinite(amount) || amount <= 0) return fail('Donation amount must be greater than zero.', 422);
    const campaign = await prisma.donationCampaign.findFirst({ where: { id: campaignId, active: true }, select: { id: true } });
    if (!campaign) return fail('Donation campaign not found.', 404);

    const order = await createOrderForDonation({
      userId: user.id,
      campaignId,
      amount,
      gateway,
      donorName,
      message,
      affiliateCode: req.cookies.get('affiliate_ref')?.value,
    });
    const session = await createGatewaySession(order.id, order.gateway, appUrlFromRequest(req));
    return NextResponse.redirect(session.redirectUrl, 303);
  } catch (error) {
    return handleRouteError(error, req);
  }
}
