import { NextRequest, NextResponse } from 'next/server';

import { audit } from '@/lib/audit';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { normalizeEmbedSettings, saveEmbedSettings } from '@/lib/embed-settings';
import { verifyCsrf } from '@/lib/csrf';

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const settings = normalizeEmbedSettings({
      enabled: form.get('enabled') === 'on',
      theme: value(form, 'theme') as any,
      width: Number(form.get('width')),
      height: Number(form.get('height')),
      ctaLabel: value(form, 'ctaLabel'),
      partnerNote: value(form, 'partnerNote'),
      allowedDomains: value(form, 'allowedDomains') || '*',
    });

    await saveEmbedSettings(settings);
    await audit({
      actorId: admin.id,
      action: 'embed.settings.update',
      entity: 'Setting',
      entityId: 'embed_widgets',
      metadata: { enabled: settings.enabled, theme: settings.theme, width: settings.width, height: settings.height },
    });
    return NextResponse.redirect(new URL('/admin/embed?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Embed settings update failed.', 500);
  }
}
