import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
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
    const action = field(form, 'action') || 'save';
    const id = field(form, 'id');
    const redirectUrl = new URL('/admin/lti-tools', req.url);

    if (action === 'delete') {
      if (!id) return fail('LTI tool ID is required.', 422);
      await prisma.ltiTool.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'lti_tool.delete', entity: 'LtiTool', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('LTI tool ID is required.', 422);
      const tool = await prisma.ltiTool.update({ where: { id }, data: { active: field(form, 'active') === 'true' } });
      await audit({ actorId: admin.id, action: tool.active ? 'lti_tool.enable' : 'lti_tool.disable', entity: 'LtiTool', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const name = field(form, 'name');
    const clientId = field(form, 'clientId');
    if (name.length < 2 || clientId.length < 2) return fail('Tool name and client ID are required.', 422);
    const data = {
      name,
      clientId,
      launchUrl: validateStoredUrl(field(form, 'launchUrl'), { label: 'Launch URL' }),
      publicKey: field(form, 'publicKey'),
      active: form.get('active') === 'on',
    };

    if (id) {
      await prisma.ltiTool.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'lti_tool.update', entity: 'LtiTool', entityId: id });
    } else {
      const tool = await prisma.ltiTool.create({ data });
      await audit({ actorId: admin.id, action: 'lti_tool.create', entity: 'LtiTool', entityId: tool.id });
    }
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error: any) {
    return fail(error.message, /required|valid|URL|ID/i.test(error.message) ? 422 : 500);
  }
}
