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
    const redirectUrl = new URL('/admin/partners', req.url);

    if (action === 'delete') {
      if (!id) return fail('Partner ID is required.', 422);
      await prisma.partnerOffer.deleteMany({ where: { partnerId: id } });
      await prisma.partner.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'partner.delete', entity: 'Partner', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('Partner ID is required.', 422);
      const partner = await prisma.partner.update({ where: { id }, data: { active: field(form, 'active') === 'true' } });
      await audit({ actorId: admin.id, action: partner.active ? 'partner.enable' : 'partner.disable', entity: 'Partner', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const name = field(form, 'name');
    if (name.length < 2) return fail('Partner name is required.', 422);
    const data = {
      name,
      website: validateStoredUrl(field(form, 'website'), { label: 'Partner website' }),
      logoUrl: validateStoredUrl(field(form, 'logoUrl'), { label: 'Partner logo', allowRelative: true }),
      active: form.get('active') !== 'off',
    };

    if (id) {
      await prisma.partner.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'partner.update', entity: 'Partner', entityId: id });
    } else {
      const partner = await prisma.partner.create({ data });
      await audit({ actorId: admin.id, action: 'partner.create', entity: 'Partner', entityId: partner.id });
    }
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error: any) {
    return fail(error.message, /required|valid|URL|ID/i.test(error.message) ? 422 : 500);
  }
}
