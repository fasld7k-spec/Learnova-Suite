import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

type GoalRequestBody = {
  json: boolean;
  csrfToken: string;
  get(key: string): FormDataEntryValue | null;
};

function cleanTitle(value: FormDataEntryValue | null) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function cleanInt(value: FormDataEntryValue | null, min: number, max: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

function cleanDueDate(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const dueDate = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(dueDate.getTime()) ? null : dueDate;
}

async function readGoalRequest(req: NextRequest): Promise<GoalRequestBody> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return {
      json: true,
      csrfToken: String(req.headers.get('x-csrf-token') || body.csrfToken || ''),
      get(key: string) {
        const value = body[key];
        return value == null ? null : String(value);
      }
    };
  }

  const form = await req.formData();
  return {
    json: false,
    csrfToken: String(form.get('csrfToken') || ''),
    get(key: string) {
      return form.get(key);
    }
  };
}

function successResponse(req: NextRequest, body: GoalRequestBody, data?: Record<string, unknown>) {
  if (body.json) return NextResponse.json({ success: true, ...(data || {}) });
  return NextResponse.redirect(new URL('/student/goals', req.url), 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const body = await readGoalRequest(req);
    if (!(await verifyCsrf(body.csrfToken))) return fail('Invalid CSRF token.', 403);
    const action = String(body.get('action') || 'create').trim().toLowerCase();
    const id = String(body.get('id') || '').trim();

    if (action === 'delete') {
      if (!id) return fail('Goal id is required.', 400);
      const goal = await prisma.learningGoal.findFirst({ where: { id, userId: user.id } });
      if (!goal) return fail('Goal not found.', 404);
      await prisma.learningGoal.delete({ where: { id } });
      return successResponse(req, body, { data: { deleted: true } });
    }

    const title = cleanTitle(body.get('title'));
    const target = cleanInt(body.get('target'), 1, 1000);

    if (!title) return fail('Goal title is required.', 400);
    if (!target) return fail('Target lessons must be between 1 and 1000.', 400);

    if (action === 'update') {
      if (!id) return fail('Goal id is required.', 400);
      const goal = await prisma.learningGoal.findFirst({ where: { id, userId: user.id } });
      if (!goal) return fail('Goal not found.', 404);
      const progress = cleanInt(body.get('progress'), 0, 1000);
      if (progress === null) return fail('Progress must be between 0 and 1000.', 400);

      const updated = await prisma.learningGoal.update({
        where: { id },
        data: {
          title,
          target,
          progress: Math.min(progress, target),
          completed: body.get('completed') === 'on' || body.get('completed') === 'true' || progress >= target,
          dueDate: cleanDueDate(body.get('dueDate')),
        },
      });
      return successResponse(req, body, { data: { goal: updated } });
    }

    const created = await prisma.learningGoal.create({
      data: {
        userId: user.id,
        title,
        target,
        dueDate: cleanDueDate(body.get('dueDate')),
      },
    });

    return successResponse(req, body, { data: { goal: created } });
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
