import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { addonConfigFromManifest, addonExtensionPoints, defaultAddonCatalog, normalizeAddonManifest, sendAddonWebhookTest } from '@/lib/addons';
import { verifyCsrf } from '@/lib/csrf';

async function readManifest(form: FormData) {
  const catalogSlug = String(form.get('catalogSlug') || '').trim();
  const catalogItem = defaultAddonCatalog.find((addon) => addon.slug === catalogSlug);
  if (catalogItem) return normalizeAddonManifest(catalogItem);

  const file = form.get('manifestFile');
  if (file instanceof File && file.size > 0) {
    if (file.size > 256_000) throw new Error('Manifest file is too large.');
    return normalizeAddonManifest(await file.text());
  }

  const manifestJson = String(form.get('manifestJson') || '').trim();
  if (manifestJson) return normalizeAddonManifest(manifestJson);

  return normalizeAddonManifest({
    name: String(form.get('name') || ''),
    slug: String(form.get('slug') || ''),
    version: String(form.get('version') || '1.0.0'),
    category: String(form.get('category') || 'General'),
    description: String(form.get('description') || ''),
    docsUrl: String(form.get('docsUrl') || ''),
    adminPath: String(form.get('adminPath') || ''),
    webhookUrl: String(form.get('webhookUrl') || ''),
    permissions: String(form.get('permissions') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    extensionPoints: String(form.get('extensionPoints') || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => (addonExtensionPoints as readonly string[]).includes(item))
      .filter(Boolean),
  });
}

async function setInstallation(appId: string, active: boolean) {
  const existing = await prisma.appInstallation.findFirst({ where: { appId, tenantId: null, userId: null } });
  if (existing) {
    await prisma.appInstallation.update({ where: { id: existing.id }, data: { active } });
    return;
  }

  await prisma.appInstallation.create({ data: { appId, active } });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || 'upsert').trim();
    const appId = String(form.get('appId') || '').trim();

    if (action === 'delete') {
      if (!appId) return fail('App ID is required.', 422);
      const app = await prisma.marketplaceApp.findUnique({ where: { id: appId } });
      if (!app) return fail('Add-on was not found.', 404);

      await prisma.appInstallation.deleteMany({ where: { appId } });
      await prisma.marketplaceApp.delete({ where: { id: appId } });
      await audit({
        actorId: admin.id,
        action: 'addon.delete',
        entity: 'marketplaceApp',
        entityId: app.id,
        metadata: { slug: app.slug, name: app.name },
      });
      return NextResponse.redirect(new URL('/admin/app-marketplace', req.url), 303);
    }

    if (action === 'test-webhook') {
      if (!appId) return fail('App ID is required.', 422);
      const result = await sendAddonWebhookTest(appId, admin.id);
      await audit({
        actorId: admin.id,
        action: 'addon.webhook.test',
        entity: 'marketplaceApp',
        entityId: appId,
        metadata: result,
      });
      return NextResponse.redirect(new URL('/admin/app-marketplace?tested=1', req.url), 303);
    }

    const catalogSlug = String(form.get('catalogSlug') || '').trim();
    const manifest = await readManifest(form);
    const installNow = form.get('install') === 'on' || form.get('install') === 'true';
    const app = await prisma.marketplaceApp.upsert({
      where: { slug: manifest.slug },
      update: {
        name: manifest.name,
        description: manifest.description,
        config: addonConfigFromManifest(manifest, { source: catalogSlug ? 'built-in-catalog' : 'admin-upload' }),
        installed: installNow ? true : undefined,
      },
      create: {
        name: manifest.name,
        slug: manifest.slug,
        description: manifest.description,
        config: addonConfigFromManifest(manifest, { source: catalogSlug ? 'built-in-catalog' : 'admin-upload' }),
        installed: installNow,
      },
    });
    if (installNow) await setInstallation(app.id, true);
    await audit({
      actorId: admin.id,
      action: catalogSlug ? 'addon.installCatalog' : 'addon.register',
      entity: 'marketplaceApp',
      entityId: app.id,
      metadata: {
        slug: app.slug,
        name: app.name,
        version: manifest.version,
        category: manifest.category,
        installNow,
        source: catalogSlug ? 'built-in-catalog' : 'admin-upload',
      },
    });
    return NextResponse.redirect(new URL('/admin/app-marketplace', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 422);
  }
}
