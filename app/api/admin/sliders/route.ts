import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateHomeCache } from '@/lib/cache';
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
    const redirectUrl = new URL('/admin/sliders', req.url);

    if (action === 'delete') {
      if (!id) return fail('Slide ID is required.', 422);
      await prisma.slider.delete({ where: { id } });
      await invalidateHomeCache();
      await audit({ actorId: admin.id, action: 'slider.delete', entity: 'Slider', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('Slide ID is required.', 422);
      const slider = await prisma.slider.update({ where: { id }, data: { active: field(form, 'active') === 'true' } });
      await invalidateHomeCache();
      await audit({ actorId: admin.id, action: slider.active ? 'slider.enable' : 'slider.disable', entity: 'Slider', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const title = field(form, 'title');
    if (title.length < 2) return fail('Slide title is required.', 422);
    const data = {
      title,
      subtitle: field(form, 'subtitle'),
      image: validateStoredUrl(field(form, 'image'), { label: 'Slide image', allowRelative: true }),
      buttonText: field(form, 'buttonText'),
      buttonUrl: validateStoredUrl(field(form, 'buttonUrl'), { label: 'Button URL', allowRelative: true }),
      sortOrder: Number(field(form, 'sortOrder') || 0),
      active: form.get('active') !== 'off',
    };

    if (id) {
      await prisma.slider.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'slider.update', entity: 'Slider', entityId: id });
    } else {
      const slider = await prisma.slider.create({ data });
      await audit({ actorId: admin.id, action: 'slider.create', entity: 'Slider', entityId: slider.id });
    }
    await invalidateHomeCache();
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error: any) {
    return fail(error.message, /required|valid|URL|ID/i.test(error.message) ? 422 : 500);
  }
}
