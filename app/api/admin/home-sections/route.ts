import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateSiteSettingsCache } from '@/lib/cache';
import { defaultHomeSections, saveHomeSectionSettings, type HomeSectionConfig } from '@/lib/home-sections';
import { verifyCsrf } from '@/lib/csrf';

function formValue(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const sections: HomeSectionConfig[] = defaultHomeSections.map((section) => ({
      ...section,
      title: formValue(form, `${section.key}_title`) || section.title,
      enabled: form.get(`${section.key}_enabled`) === 'on',
      sortOrder: Math.max(1, Number(formValue(form, `${section.key}_sortOrder`) || section.sortOrder)),
    }));

    await saveHomeSectionSettings(sections);
    await invalidateSiteSettingsCache();
    await audit({
      actorId: admin.id,
      action: 'home_sections.update',
      entity: 'Setting',
      entityId: 'home_sections',
      metadata: {
        enabled: sections.filter((section) => section.enabled).map((section) => section.key),
        disabled: sections.filter((section) => !section.enabled).map((section) => section.key),
      },
    });

    return NextResponse.redirect(new URL('/admin/home-sections?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Home sections update failed.', 500);
  }
}
