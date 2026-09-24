import { NextRequest, NextResponse } from 'next/server';
import { fail, ok } from '@/lib/api';
import { audit } from '@/lib/audit';
import { generateApiKey, hashApiKey, serializeApiScopes } from '@/lib/api-key';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/api-keys', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('API key id is required.', 422);
      await prisma.apiKey.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'api_key.delete', entity: 'ApiKey', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('API key id is required.', 422);
      const current = await prisma.apiKey.findUnique({ where: { id } });
      if (!current) return fail('API key not found.', 404);
      const updated = await prisma.apiKey.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: updated.active ? 'api_key.enable' : 'api_key.disable', entity: 'ApiKey', entityId: id });
      return redirect(req);
    }

    if (action === 'update') {
      if (!id) return fail('API key id is required.', 422);
      const name = value(form, 'name');
      if (name.length < 2) return fail('API key name is required.', 422);
      await prisma.apiKey.update({ where: { id }, data: { name, scopes: serializeApiScopes(form.getAll('scopes')) } });
      await audit({ actorId: admin.id, action: 'api_key.update', entity: 'ApiKey', entityId: id });
      return redirect(req);
    }

    const key = generateApiKey();
    const name = value(form, 'name');
    if (name.length < 2) return fail('API key name is required.', 422);
    const row = await prisma.apiKey.create({ data: { name, keyHash: hashApiKey(key), scopes: serializeApiScopes(form.getAll('scopes')) } });
    await audit({ actorId: admin.id, action: 'api_key.create', entity: 'ApiKey', entityId: row.id });

    if (req.headers.get('accept')?.includes('application/json')) {
      return ok({ apiKey: key, message: 'Copy this key now. It will not be shown again.' });
    }

    const response = NextResponse.redirect(new URL('/admin/api-keys?created=1', req.url), 303);
    response.cookies.set('learnova_flash_api_key', key, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 300, path: '/admin/api-keys' });
    return response;
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
