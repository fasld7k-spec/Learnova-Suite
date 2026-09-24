import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { resetEmailTemplateOverride, saveEmailTemplateOverride } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const key = String(form.get('key') || '').trim();
    if (!key) return fail('Template key is required.', 422);
    if (form.get('intent') === 'reset') {
      await resetEmailTemplateOverride(key);
      await audit({ actorId: admin.id, action: 'email_template.reset', entity: 'EmailTemplate', entityId: key });
      return NextResponse.redirect(new URL('/admin/email-templates', req.url), 303);
    }

    const subject = String(form.get('subject') || '').trim();
    const html = String(form.get('html') || '').trim();
    if (subject.length < 2) return fail('Email subject is required.', 422);
    if (html.length < 10) return fail('Email HTML body is required.', 422);

    await saveEmailTemplateOverride(
      key,
      subject,
      html
    );
    await audit({ actorId: admin.id, action: 'email_template.update', entity: 'EmailTemplate', entityId: key });
    return NextResponse.redirect(new URL('/admin/email-templates', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
