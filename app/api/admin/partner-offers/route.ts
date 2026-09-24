import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';
import { verifyCsrf } from '@/lib/csrf';

function field(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = field(form, 'action') || 'create';
    const id = field(form, 'id');
    const redirectUrl = new URL('/admin/partner-offers', req.url);

    if (action === 'delete') {
      if (!id) return fail('Offer ID is required.', 422);
      await prisma.partnerOffer.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'partner_offer.delete', entity: 'PartnerOffer', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('Offer ID is required.', 422);
      const offer = await prisma.partnerOffer.update({ where: { id }, data: { active: field(form, 'active') === 'true' } });
      await audit({ actorId: admin.id, action: offer.active ? 'partner_offer.enable' : 'partner_offer.disable', entity: 'PartnerOffer', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const partnerId = field(form, 'partnerId');
    const title = field(form, 'title');
    if (!partnerId || title.length < 2) return fail('Partner and offer title are required.', 422);
    const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true } });
    if (!partner) return fail('Partner was not found.', 404);

    const data = {
      partnerId,
      title,
      description: field(form, 'description'),
      url: validateStoredUrl(field(form, 'url'), { label: 'Offer URL', allowRelative: true }),
      active: form.get('active') === 'on',
    };

    if (id) {
      await prisma.partnerOffer.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'partner_offer.update', entity: 'PartnerOffer', entityId: id });
    } else {
      const offer = await prisma.partnerOffer.create({ data });
      await audit({ actorId: admin.id, action: 'partner_offer.create', entity: 'PartnerOffer', entityId: offer.id });
    }
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error: any) {
    return fail(error.message, /required|valid|URL|not found|ID/i.test(error.message) ? 422 : 500);
  }
}
