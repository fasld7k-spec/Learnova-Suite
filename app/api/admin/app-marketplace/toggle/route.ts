import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const appId = String(form.get('appId') || '').trim();
    const active = form.get('active') === 'true';
    if (!appId) return fail('App ID is required.', 422);

    const app = await prisma.marketplaceApp.update({ where: { id: appId }, data: { installed: active } });
    const existing = await prisma.appInstallation.findFirst({ where: { appId, tenantId: null, userId: null } });
    if (existing) {
      await prisma.appInstallation.update({ where: { id: existing.id }, data: { active } });
    } else {
      await prisma.appInstallation.create({ data: { appId, active } });
    }
    await audit({
      actorId: admin.id,
      action: active ? 'addon.activate' : 'addon.disable',
      entity: 'marketplaceApp',
      entityId: app.id,
      metadata: { slug: app.slug, name: app.name, active },
    });

    return NextResponse.redirect(new URL('/admin/app-marketplace', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
