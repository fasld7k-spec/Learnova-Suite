import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { sanitizeCertificateTemplateHtml } from '@/lib/certificates';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirectBack(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/certificate-templates', req.url), 303);
}

function formString(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function setSingleActiveTemplate(id: string) {
  await prisma.$transaction([
    prisma.certificateTemplate.updateMany({ where: { id: { not: id } }, data: { active: false } }),
    prisma.certificateTemplate.update({ where: { id }, data: { active: true } }),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = formString(form, 'action') || 'create';
    const id = formString(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Template id is required', 400);
      const template = await prisma.certificateTemplate.findUnique({ where: { id } });
      if (!template) return fail('Template not found', 404);
      if (template.active) return fail('Active certificate template cannot be deleted. Activate another template first.', 409);
      await prisma.certificateTemplate.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'certificate_template.delete', entity: 'CertificateTemplate', entityId: id, metadata: { name: template.name } });
      return redirectBack(req);
    }

    if (action === 'activate') {
      if (!id) return fail('Template id is required', 400);
      await setSingleActiveTemplate(id);
      await audit({ actorId: admin.id, action: 'certificate_template.activate', entity: 'CertificateTemplate', entityId: id });
      return redirectBack(req);
    }

    if (action === 'duplicate') {
      if (!id) return fail('Template id is required', 400);
      const template = await prisma.certificateTemplate.findUnique({ where: { id } });
      if (!template) return fail('Template not found', 404);
      const copy = await prisma.certificateTemplate.create({
        data: {
          name: `${template.name} Copy`,
          html: template.html,
          active: false,
        },
      });
      await audit({ actorId: admin.id, action: 'certificate_template.duplicate', entity: 'CertificateTemplate', entityId: copy.id, metadata: { sourceId: template.id, sourceName: template.name } });
      return redirectBack(req);
    }

    const name = formString(form, 'name');
    const html = sanitizeCertificateTemplateHtml(String(form.get('html') || ''));
    const active = form.get('active') === 'on';
    if (!name) return fail('Template name is required', 400);

    if (action === 'update') {
      if (!id) return fail('Template id is required', 400);
      if (active) {
        await prisma.$transaction([
          prisma.certificateTemplate.updateMany({ where: { id: { not: id } }, data: { active: false } }),
          prisma.certificateTemplate.update({ where: { id }, data: { name, html, active: true } }),
        ]);
      } else {
        await prisma.certificateTemplate.update({ where: { id }, data: { name, html, active: false } });
      }
      await audit({ actorId: admin.id, action: 'certificate_template.update', entity: 'CertificateTemplate', entityId: id, metadata: { name, active } });
      return redirectBack(req);
    }

    if (action !== 'create') return fail('Unsupported template action', 400);

    const created = await prisma.$transaction(async (tx) => {
      if (active) await tx.certificateTemplate.updateMany({ data: { active: false } });
      return tx.certificateTemplate.create({ data: { name, html, active } });
    });
    await audit({ actorId: admin.id, action: 'certificate_template.create', entity: 'CertificateTemplate', entityId: created.id, metadata: { name, active } });

    return redirectBack(req);
  } catch (e: any) {
    const message = e?.message || 'Unable to save certificate template';
    const isInputError = /Certificate template|Template name|Template id|unsafe HTML|required|too large/i.test(message);
    return fail(message, isInputError ? 400 : 500);
  }
}
