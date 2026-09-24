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
    const action = String(form.get('action') || 'create');
    const id = String(form.get('id') || '').trim();

    if (action === 'delete') {
      if (!id) return fail('Template id is required.', 422);
      await prisma.invoiceTemplate.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'invoice_template.delete', entity: 'invoiceTemplate', entityId: id });
      return NextResponse.redirect(new URL('/admin/invoice-templates?deleted=1', req.url), 303);
    }

    const name = String(form.get('name') || '').trim();
    const html = String(form.get('html') || '').trim();
    const active = form.get('active') === 'on';
    if (!name || !html) return fail('Name and HTML are required.', 422);

    if (active) await prisma.invoiceTemplate.updateMany({ data: { active: false } });
    const row = id
      ? await prisma.invoiceTemplate.update({ where: { id }, data: { name, html, active } })
      : await prisma.invoiceTemplate.create({ data: { name, html, active } });

    await audit({ actorId: admin.id, action: id ? 'invoice_template.update' : 'invoice_template.create', entity: 'invoiceTemplate', entityId: row.id });
    return NextResponse.redirect(new URL('/admin/invoice-templates?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Invoice template update failed.', 500);
  }
}
