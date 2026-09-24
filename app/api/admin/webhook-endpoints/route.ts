import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/secret-fields';
import { validateStoredUrl } from '@/lib/url-validation';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create').trim();
    const id = String(form.get('id') || '').trim();
    const redirectUrl = new URL('/admin/webhook-endpoints', req.url);

    if (action === 'delete') {
      if (!id) return fail('Endpoint ID is required.', 422);
      const endpoint = await prisma.webhookEndpoint.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'webhook_endpoint.delete', entity: 'WebhookEndpoint', entityId: id, metadata: { name: endpoint.name, url: endpoint.url } });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('Endpoint ID is required.', 422);
      const endpoint = await prisma.webhookEndpoint.update({ where: { id }, data: { active: String(form.get('active')) === 'true' } });
      await audit({ actorId: admin.id, action: endpoint.active ? 'webhook_endpoint.enable' : 'webhook_endpoint.disable', entity: 'WebhookEndpoint', entityId: id, metadata: { name: endpoint.name } });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const name = String(form.get('name') || '').trim();
    const url = validateStoredUrl(String(form.get('url') || '').trim(), { label: 'Webhook URL' });
    const secret = String(form.get('secret') || '').trim();

    if (!name || !url) return fail('Name and URL are required.', 422);

    const data = {
      name,
      url,
      active: form.get('active') === 'on'
    };
    if (id) {
      const endpoint = await prisma.webhookEndpoint.update({
        where: { id },
        data: {
          ...data,
          ...(form.get('clearSecret') === 'on' ? { secret: null } : {}),
          ...(secret ? { secret: encryptSecret(secret) } : {}),
        },
      });
      await audit({ actorId: admin.id, action: 'webhook_endpoint.update', entity: 'WebhookEndpoint', entityId: endpoint.id, metadata: { name, url } });
    } else {
      const endpoint = await prisma.webhookEndpoint.create({ data: { ...data, secret: secret ? encryptSecret(secret) : null } });
      await audit({ actorId: admin.id, action: 'webhook_endpoint.create', entity: 'WebhookEndpoint', entityId: endpoint.id, metadata: { name, url } });
    }
    return NextResponse.redirect(redirectUrl, 303);
  } catch (e: any) {
    return fail(e.message, /required|valid|URL|ID/i.test(e.message) ? 422 : 500);
  }
}
