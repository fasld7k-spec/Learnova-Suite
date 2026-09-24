import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { getAffiliateAddon } from '@/lib/affiliate';
import { audit } from '@/lib/audit';
import { verifyCsrf } from '@/lib/csrf';

function normalizeCode(value: FormDataEntryValue | null, userId: string) {
  const raw = String(value || '').trim().toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || `AFF-${userId.slice(0, 6).toUpperCase()}-ADMIN`;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const addon = await getAffiliateAddon();
    if (!addon.active) return fail('Affiliate Growth add-on is disabled.', 403);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create-link');

    if (action === 'update-link') {
      const id = String(form.get('id') || '');
      const userId = String(form.get('userId') || '');
      const code = normalizeCode(form.get('code'), userId);
      const clicks = Math.max(0, Number(form.get('clicks') || 0));
      const sales = Math.max(0, Number(form.get('sales') || 0));
      if (!id || !userId) return fail('Affiliate link and user are required.', 400);

      const link = await prisma.affiliateLink.update({
        where: { id },
        data: { userId, code, clicks, sales },
      });
      await audit({ actorId: admin.id, action: 'affiliate_link.update', entity: 'AffiliateLink', entityId: link.id, metadata: { code, userId } });
      return NextResponse.redirect(new URL('/admin/affiliates', req.url), 303);
    }

    if (action === 'delete-link') {
      const id = String(form.get('id') || '');
      if (!id) return fail('Affiliate link is required.', 400);
      await prisma.affiliateLink.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'affiliate_link.delete', entity: 'AffiliateLink', entityId: id });
      return NextResponse.redirect(new URL('/admin/affiliates', req.url), 303);
    }

    if (action === 'update-commission') {
      const id = String(form.get('id') || '');
      const status = String(form.get('status') || 'PENDING').toUpperCase();
      const amount = Number(form.get('amount') || 0);
      if (!id || amount <= 0) return fail('Commission and amount are required.', 400);
      const commission = await prisma.affiliateCommission.update({
        where: { id },
        data: {
          amount,
          status: ['PENDING', 'APPROVED', 'PAID', 'VOID'].includes(status) ? status : 'PENDING',
        },
      });
      await audit({ actorId: admin.id, action: 'affiliate_commission.update', entity: 'AffiliateCommission', entityId: id, metadata: { amount, status: commission.status } });
      return NextResponse.redirect(new URL('/admin/affiliates', req.url), 303);
    }

    if (action === 'delete-commission') {
      const id = String(form.get('id') || '');
      if (!id) return fail('Commission is required.', 400);
      await prisma.affiliateCommission.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'affiliate_commission.delete', entity: 'AffiliateCommission', entityId: id });
      return NextResponse.redirect(new URL('/admin/affiliates', req.url), 303);
    }

    if (action === 'record-commission') {
      const affiliateUserId = String(form.get('affiliateUserId') || '');
      const orderId = String(form.get('orderId') || '');
      const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
      const amount = Number(form.get('amount') || 0) || (order ? Number(order.total) * (addon.defaultCommission / 100) : 0);
      const status = String(form.get('status') || 'PENDING').toUpperCase();
      if (!affiliateUserId || !orderId || amount <= 0) return fail('Affiliate, order and amount are required.', 400);

      const commission = await prisma.affiliateCommission.create({
        data: {
          affiliateUserId,
          orderId,
          amount,
          status: ['PENDING', 'APPROVED', 'PAID', 'VOID'].includes(status) ? status : 'PENDING'
        }
      });
      await audit({
        actorId: admin.id,
        action: 'affiliate_commission.create',
        entity: 'AffiliateCommission',
        entityId: commission.id,
        metadata: { affiliateUserId, orderId, amount, status: commission.status },
      });

      return NextResponse.redirect(new URL('/admin/affiliates', req.url), 303);
    }

    const userId = String(form.get('userId') || '');
    const code = normalizeCode(form.get('code'), userId);
    const clicks = Math.max(0, Number(form.get('clicks') || 0));
    const sales = Math.max(0, Number(form.get('sales') || 0));
    if (!userId) return fail('Affiliate user is required.', 400);

    const link = await prisma.affiliateLink.upsert({
      where: { code },
      update: { clicks, sales },
      create: { userId, code, clicks, sales }
    });
    await audit({ actorId: admin.id, action: 'affiliate_link.upsert', entity: 'AffiliateLink', entityId: link.id, metadata: { code, userId } });

    return NextResponse.redirect(new URL('/admin/affiliates', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
