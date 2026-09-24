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

function optionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Sponsorship dates must be valid.');
  return date;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = field(form, 'action') || 'create';
    const id = field(form, 'id');
    const redirectUrl = new URL('/admin/sponsorships', req.url);

    if (action === 'delete') {
      if (!id) return fail('Sponsorship ID is required.', 422);
      await prisma.sponsorship.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'sponsorship.delete', entity: 'Sponsorship', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('Sponsorship ID is required.', 422);
      const sponsorship = await prisma.sponsorship.update({ where: { id }, data: { active: field(form, 'active') === 'true' } });
      await audit({ actorId: admin.id, action: sponsorship.active ? 'sponsorship.enable' : 'sponsorship.disable', entity: 'Sponsorship', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const sponsor = field(form, 'sponsor');
    const placement = field(form, 'placement');
    if (sponsor.length < 2 || placement.length < 2) return fail('Sponsor and placement are required.', 422);

    const data = {
      sponsor,
      placement,
      imageUrl: validateStoredUrl(field(form, 'imageUrl'), { label: 'Sponsor image', allowRelative: true }),
      targetUrl: validateStoredUrl(field(form, 'targetUrl'), { label: 'Sponsor target URL', allowRelative: true }),
      startsAt: optionalDate(field(form, 'startsAt')),
      endsAt: optionalDate(field(form, 'endsAt')),
      active: form.get('active') === 'on',
    };
    if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
      return fail('End date must be after start date.', 422);
    }

    if (id) {
      await prisma.sponsorship.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'sponsorship.update', entity: 'Sponsorship', entityId: id });
    } else {
      const sponsorship = await prisma.sponsorship.create({ data });
      await audit({ actorId: admin.id, action: 'sponsorship.create', entity: 'Sponsorship', entityId: sponsorship.id });
    }
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error: any) {
    return fail(error.message, /required|valid|URL|date|ID/i.test(error.message) ? 422 : 500);
  }
}
