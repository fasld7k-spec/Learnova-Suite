import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/tenant-courses', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'upsert';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Tenant course id is required.', 422);
      await prisma.tenantCourse.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'tenant_course.delete', entity: 'TenantCourse', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Tenant course id is required.', 422);
      const current = await prisma.tenantCourse.findUnique({ where: { id } });
      if (!current) return fail('Tenant course not found.', 404);
      await prisma.tenantCourse.update({ where: { id }, data: { featured: !current.featured } });
      return redirect(req);
    }

    const tenantId = value(form, 'tenantId');
    const courseId = value(form, 'courseId');
    const featured = form.get('featured') === 'on';
    if (!tenantId || !courseId) return fail('Tenant and course are required.', 422);

    const [tenant, course] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
      prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
    ]);
    if (!tenant) return fail('Tenant not found.', 404);
    if (!course) return fail('Course not found.', 404);

    if (action === 'update') {
      if (!id) return fail('Tenant course id is required.', 422);
      await prisma.tenantCourse.update({ where: { id }, data: { tenantId, courseId, featured } });
      await audit({ actorId: admin.id, action: 'tenant_course.update', entity: 'TenantCourse', entityId: id });
      return redirect(req);
    }

    const row = await prisma.tenantCourse.upsert({
      where: { tenantId_courseId: { tenantId, courseId } },
      update: { featured },
      create: { tenantId, courseId, featured },
    });
    await audit({ actorId: admin.id, action: 'tenant_course.upsert', entity: 'TenantCourse', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Tenant course update failed.', 500);
  }
}
