import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { saveContentProtectionSettings } from '@/lib/content-protection';
import { verifyCsrf } from '@/lib/csrf';
import { saveFileToStorage } from '@/lib/storage';

const watermarkLogoTypes = ['image/png', 'image/jpeg', 'image/webp'];
const maxWatermarkLogoBytes = 1024 * 1024 * 2;

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const logoFile = form.get('watermarkLogoFile') as File | null;

    if (logoFile && logoFile.size > 0) {
      const uploaded = await saveFileToStorage(logoFile, {
        directory: 'watermarks',
        allowedTypes: watermarkLogoTypes,
        maxBytes: maxWatermarkLogoBytes,
        purpose: 'Watermark logo'
      });
      if (uploaded?.url) form.set('watermarkLogoUrl', uploaded.url);
    }

    const settings = await saveContentProtectionSettings(form);
    const auditSettings = { ...settings, signingSecret: settings.signingSecret ? '[saved]' : '' };
    await audit({
      actorId: admin.id,
      action: 'security.settings.updated',
      entity: 'Setting',
      entityId: 'contentProtection',
      metadata: auditSettings,
    });
    return NextResponse.redirect(new URL('/admin/security', req.url), 303);
  } catch (e: any) {
    return fail(e.message || 'Unable to save security settings', 500);
  }
}
