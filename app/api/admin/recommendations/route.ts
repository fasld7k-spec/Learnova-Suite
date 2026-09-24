import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { toList } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

const audiences = new Set(['ALL', 'STUDENT', 'INSTRUCTOR']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/recommendations', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function validCourseIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return rows.map((row) => row.id);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Recommendation rule id is required.', 422);
      await prisma.recommendationRule.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'recommendation_rule.delete', entity: 'RecommendationRule', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Recommendation rule id is required.', 422);
      const current = await prisma.recommendationRule.findUnique({ where: { id } });
      if (!current) return fail('Recommendation rule not found.', 404);
      const updated = await prisma.recommendationRule.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: updated.active ? 'recommendation_rule.enable' : 'recommendation_rule.disable', entity: 'RecommendationRule', entityId: id });
      return redirect(req);
    }

    const title = value(form, 'title');
    const audience = value(form, 'audience') || 'ALL';
    const courseIds = await validCourseIds(form.getAll('courseIds').map(String));
    if (title.length < 2) return fail('Recommendation title is required.', 422);
    if (!audiences.has(audience)) return fail('Recommendation audience is invalid.', 422);

    const data = { title, courseIds: toList(courseIds), audience, active: form.get('active') === 'on' };
    if (action === 'update') {
      if (!id) return fail('Recommendation rule id is required.', 422);
      await prisma.recommendationRule.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'recommendation_rule.update', entity: 'RecommendationRule', entityId: id });
      return redirect(req);
    }

    const row = await prisma.recommendationRule.create({ data });
    await audit({ actorId: admin.id, action: 'recommendation_rule.create', entity: 'RecommendationRule', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Recommendation update failed.', 500);
  }
}
