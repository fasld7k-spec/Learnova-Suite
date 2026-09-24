import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { decryptSecret, encryptSecret } from '@/lib/secret-fields';
import { testAiProvider } from '@/lib/ai';
import { invalidateSiteSettingsCache } from '@/lib/cache';
import { languagePresets, normalizeLocale } from '@/lib/localized-copy';
import { normalizeAppUrl } from '@/lib/app-url';
import { verifyCsrf } from '@/lib/csrf';

function field(form: FormData, key: string, fallback = '') {
  return String(form.get(key) || fallback).trim();
}

function percentage(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

function port(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key));
  if (!Number.isFinite(value) || value < 1 || value > 65535) return fallback;
  return Math.round(value);
}

const socialKeys = ['x', 'linkedin', 'youtube', 'facebook'];

function socialLinksFromForm(form: FormData) {
  return socialKeys
    .map((label) => ({ label, href: field(form, `social_${label}`) }))
    .filter((link) => link.href);
}

async function activateSiteLanguage(code: string, rtl: boolean) {
  const normalized = normalizeLocale(code);
  const preset = languagePresets.find((language) => language.code === normalized);
  const existing = await prisma.language.findUnique({ where: { code: normalized } }).catch(() => null);
  const direction = existing?.direction || preset?.direction || (rtl ? 'rtl' : 'ltr');
  const name = existing?.name || preset?.nativeName || normalized.toUpperCase();

  await prisma.$transaction([
    prisma.language.updateMany({ data: { active: false } }),
    prisma.language.upsert({
      where: { code: normalized },
      update: { name, direction, active: true },
      create: { code: normalized, name, direction, active: true }
    })
  ]);

  return { code: normalized, direction };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);

    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const currentRow = await prisma.setting.findUnique({ where: { key: 'general' } });
    const current = fromJsonObject<any>(currentRow?.value);
    const aiProvider = field(form, 'aiProvider', 'demo');
    const smtpPassword = field(form, 'smtpPassword') || decryptSecret(current.smtpPassword) || '';
    const aiApiKey = field(form, 'aiApiKey') || decryptSecret(current.aiApiKey) || '';
    const storageSecretAccessKey = field(form, 'storageSecretAccessKey') || decryptSecret(current.storageSecretAccessKey) || '';
    const googleClientSecret = field(form, 'googleClientSecret') || decryptSecret(current.googleClientSecret) || '';
    const githubClientSecret = field(form, 'githubClientSecret') || decryptSecret(current.githubClientSecret) || '';
    const facebookClientSecret = field(form, 'facebookClientSecret') || decryptSecret(current.facebookClientSecret) || '';
    const requestedLanguage = field(form, 'defaultLanguage', 'en');
    const activeLanguage = await activateSiteLanguage(requestedLanguage, form.get('rtl') === 'on');

    const value = toJson({
      siteName: field(form, 'siteName', 'Learnova Suite'),
      tagline: field(form, 'tagline', 'Pro learning suite'),
      publicAppUrl: normalizeAppUrl(field(form, 'publicAppUrl')),
      officialEmail: field(form, 'officialEmail', 'hello@learnova.test'),
      logoUrl: field(form, 'logoUrl'),
      faviconUrl: field(form, 'faviconUrl'),
      supportPhone: field(form, 'supportPhone'),
      supportEmail: field(form, 'supportEmail', 'support@learnova.test'),
      currency: field(form, 'currency', 'USD').toUpperCase(),
      defaultLanguage: activeLanguage.code,
      primaryColor: field(form, 'primaryColor', '#1D9BF0'),
      rtl: activeLanguage.direction === 'rtl',
      registrationEnabled: form.get('registrationEnabled') === 'on',
      instructorsEnabled: form.get('instructorsEnabled') === 'on',
      platformCommission: percentage(form, 'platformCommission', 30),
      certificateIssuer: field(form, 'certificateIssuer', 'Learnova Suite'),
      certificatePrefix: field(form, 'certificatePrefix', 'EDU'),
      navLinks: field(form, 'navLinks'),
      footerLinks: field(form, 'footerLinks'),
      socialLinks: socialLinksFromForm(form),
      paymentNotes: field(form, 'paymentNotes'),
      emailProvider: field(form, 'emailProvider', 'smtp'),
      smtpSender: field(form, 'smtpSender', 'no-reply@learnova.test'),
      smtpHost: field(form, 'smtpHost'),
      smtpPort: port(form, 'smtpPort', Number(current.smtpPort || 587)),
      smtpUser: field(form, 'smtpUser'),
      smtpPassword: encryptSecret(smtpPassword),
      smtpSecure: form.get('smtpSecure') === 'on',
      smtpStartTls: form.get('smtpStartTls') === 'on',
      smtpEhloDomain: field(form, 'smtpEhloDomain', 'localhost'),
      aiEnabled: form.get('aiEnabled') === 'on',
      aiAssistantEnabled: form.get('aiAssistantEnabled') === 'on',
      aiProvider,
      aiApiKey: encryptSecret(aiApiKey),
      aiModel: field(form, 'aiModel', 'gpt-4o-mini'),
      aiEndpoint: field(form, 'aiEndpoint'),
      storageProvider: field(form, 'storageProvider', 'local').toLowerCase(),
      storageBucket: field(form, 'storageBucket'),
      storageAccessKeyId: field(form, 'storageAccessKeyId'),
      storageSecretAccessKey: encryptSecret(storageSecretAccessKey),
      storageRegion: field(form, 'storageRegion', 'auto'),
      storageEndpoint: field(form, 'storageEndpoint'),
      storagePublicBaseUrl: field(form, 'storagePublicBaseUrl'),
      allowLocalUploads: form.get('allowLocalUploads') === 'on',
      googleClientId: field(form, 'googleClientId'),
      googleClientSecret: encryptSecret(googleClientSecret),
      googleRedirectUri: field(form, 'googleRedirectUri'),
      githubClientId: field(form, 'githubClientId'),
      githubClientSecret: encryptSecret(githubClientSecret),
      githubRedirectUri: field(form, 'githubRedirectUri'),
      facebookClientId: field(form, 'facebookClientId'),
      facebookClientSecret: encryptSecret(facebookClientSecret),
      facebookRedirectUri: field(form, 'facebookRedirectUri'),
    });

    await prisma.setting.upsert({
      where: { key: 'general' },
      update: { value },
      create: { key: 'general', value },
    });

    await invalidateSiteSettingsCache();
    await audit({
      actorId: admin.id,
      action: 'settings.general.update',
      entity: 'setting',
      entityId: 'general',
      metadata: {
        siteName: field(form, 'siteName', 'Learnova Suite'),
        publicAppUrl: normalizeAppUrl(field(form, 'publicAppUrl')),
        currency: field(form, 'currency', 'USD').toUpperCase(),
        defaultLanguage: activeLanguage.code,
        rtl: activeLanguage.direction === 'rtl',
        registrationEnabled: form.get('registrationEnabled') === 'on',
        instructorsEnabled: form.get('instructorsEnabled') === 'on',
        emailProvider: field(form, 'emailProvider', 'smtp'),
        aiEnabled: form.get('aiEnabled') === 'on',
        aiProvider: field(form, 'aiProvider', 'demo'),
        storageProvider: field(form, 'storageProvider', 'local').toLowerCase(),
      },
    });

    const intent = field(form, 'intent');

    if (intent === 'test-email') {
      const to = field(form, 'testEmailTo', field(form, 'supportEmail', 'support@learnova.test'));
      await sendEmail({
        to,
        subject: `SMTP test from ${field(form, 'siteName', 'Learnova Suite')}`,
        html: `<h1>Email test sent</h1><p>This message confirms that the admin email configuration can be used by the platform.</p>`
      });
      await audit({
        actorId: admin.id,
        action: 'settings.email.test',
        entity: 'setting',
        entityId: 'general',
        metadata: { to, provider: field(form, 'emailProvider', 'smtp') },
      });
      return NextResponse.redirect(new URL('/admin/settings?emailTest=sent', req.url), 303);
    }

    if (intent === 'test-ai') {
      const result = await testAiProvider();
      const url = new URL('/admin/settings', req.url);
      url.searchParams.set('aiTest', result.ok ? 'success' : 'failed');
      url.searchParams.set('aiProvider', result.provider);
      url.searchParams.set('aiMessage', result.message);
      await audit({
        actorId: admin.id,
        action: 'settings.ai.test',
        entity: 'setting',
        entityId: 'general',
        metadata: { ok: result.ok, provider: result.provider, message: result.message },
      });
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.redirect(new URL('/admin/settings?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
