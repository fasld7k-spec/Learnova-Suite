import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const types = new Set(['B2B', 'TEAM', 'ENTERPRISE']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/course-licenses', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function seatsValue(form: FormData) {
  const seats = Number(form.get('seats') || 1);
  if (!Number.isInteger(seats) || seats < 1) throw new Error('Seats must be a positive integer.');
  return seats;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('License id is required.', 422);
      await prisma.courseLicense.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'course_license.delete', entity: 'CourseLicense', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('License id is required.', 422);
      const current = await prisma.courseLicense.findUnique({ where: { id } });
      if (!current) return fail('License not found.', 404);
      const license = await prisma.courseLicense.update({ where: { id }, data: { active: !current.active } });
      await audit({
        actorId: admin.id,
        action: license.active ? 'course_license.enable' : 'course_license.disable',
        entity: 'CourseLicense',
        entityId: id,
      });
      return redirect(req);
    }

    const courseId = value(form, 'courseId');
    const buyerId = value(form, 'buyerId');
    const type = value(form, 'type').toUpperCase() || 'B2B';
    const seats = seatsValue(form);
    const active = form.get('active') === 'on';
    if (!courseId || !buyerId) return fail('Course and buyer are required.', 422);
    if (!types.has(type)) return fail('Invalid license type.', 422);

    const [course, buyer] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: buyerId }, select: { id: true } }),
    ]);
    if (!course) return fail('Course not found.', 404);
    if (!buyer) return fail('Buyer not found.', 404);

    const data = { courseId, buyerId, type, seats, active };
    if (action === 'update') {
      if (!id) return fail('License id is required.', 422);
      await prisma.courseLicense.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'course_license.update', entity: 'CourseLicense', entityId: id });
      return redirect(req);
    }

    const license = await prisma.courseLicense.create({ data });
    await audit({ actorId: admin.id, action: 'course_license.create', entity: 'CourseLicense', entityId: license.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Course license update failed.', 500);
  }
}
