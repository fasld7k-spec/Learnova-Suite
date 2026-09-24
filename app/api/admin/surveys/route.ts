import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const questionTypes = new Set(['text', 'rating', 'boolean']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/surveys', req.url), 303);
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
      if (!id) return fail('Survey id is required.', 422);
      await prisma.surveyResponse.deleteMany({ where: { surveyId: id } });
      await prisma.survey.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'survey.delete', entity: 'Survey', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Survey id is required.', 422);
      const current = await prisma.survey.findUnique({ where: { id } });
      if (!current) return fail('Survey not found.', 404);
      const updated = await prisma.survey.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: updated.active ? 'survey.enable' : 'survey.disable', entity: 'Survey', entityId: id });
      return redirect(req);
    }

    if (action === 'clear_responses') {
      if (!id) return fail('Survey id is required.', 422);
      const result = await prisma.surveyResponse.deleteMany({ where: { surveyId: id } });
      await audit({ actorId: admin.id, action: 'survey.responses.clear', entity: 'Survey', entityId: id, metadata: { deleted: result.count } });
      return redirect(req);
    }

    const title = value(form, 'title');
    const questionLabel = value(form, 'questionLabel');
    const questionType = value(form, 'questionType') || 'text';
    if (title.length < 2) return fail('Survey title is required.', 422);
    if (questionLabel.length < 2) return fail('Question label is required.', 422);
    if (!questionTypes.has(questionType)) return fail('Question type is invalid.', 422);

    const data = {
      title,
      questions: toJson([{ name: 'q1', label: questionLabel, type: questionType }]),
      active: form.get('active') === 'on',
    };

    if (action === 'update') {
      if (!id) return fail('Survey id is required.', 422);
      await prisma.survey.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'survey.update', entity: 'Survey', entityId: id });
      return redirect(req);
    }

    const survey = await prisma.survey.create({ data });
    await audit({ actorId: admin.id, action: 'survey.create', entity: 'Survey', entityId: survey.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Survey update failed.', 500);
  }
}
