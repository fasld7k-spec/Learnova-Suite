import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { rewriteContent } from '@/lib/ai';
import { verifyCsrf } from '@/lib/csrf';
import { getEditableEmailTemplates, saveEmailTemplateOverride } from '@/lib/email';
import { prisma } from '@/lib/prisma';

function field(form: FormData, key: string, fallback = '') {
  return String(form.get(key) || fallback).trim();
}

function redirect(req: NextRequest, query = '') {
  return NextResponse.redirect(new URL(`/admin/content-rewrite${query}`, req.url), 303);
}

const targetFields: Record<string, Set<string>> = {
  course: new Set(['title', 'shortDescription', 'fullDescription']),
  page: new Set(['titleEn', 'bodyEn', 'titleAr', 'bodyAr', 'seoTitle', 'seoDescription']),
  blog: new Set(['title', 'excerpt', 'content']),
  email: new Set(['subject', 'html']),
};

function parseTargetRef(value: string) {
  const [type, id, fieldName] = value.split(':');
  if (!type || !id || !fieldName || !targetFields[type]?.has(fieldName)) {
    throw new Error('Choose a valid rewrite target.');
  }
  return { type, id, fieldName };
}

async function targetText(targetRef: string) {
  const target = parseTargetRef(targetRef);
  if (target.type === 'course') {
    const row = await prisma.course.findUnique({ where: { id: target.id } });
    if (!row) throw new Error('Target course was not found.');
    return String((row as any)[target.fieldName] || '');
  }
  if (target.type === 'page') {
    const row = await prisma.page.findUnique({ where: { id: target.id } });
    if (!row) throw new Error('Target page was not found.');
    return String((row as any)[target.fieldName] || '');
  }
  if (target.type === 'blog') {
    const row = await prisma.blogPost.findUnique({ where: { id: target.id } });
    if (!row) throw new Error('Target blog post was not found.');
    return String((row as any)[target.fieldName] || '');
  }
  const template = (await getEditableEmailTemplates()).find((item) => item.key === target.id);
  if (!template) throw new Error('Target email template was not found.');
  return String((template as any)[target.fieldName] || '');
}

async function applyTargetText(targetRef: string, output: string) {
  const target = parseTargetRef(targetRef);
  if (target.type === 'course') {
    await prisma.course.update({ where: { id: target.id }, data: { [target.fieldName]: output } });
    return target;
  }
  if (target.type === 'page') {
    await prisma.page.update({ where: { id: target.id }, data: { [target.fieldName]: output } });
    return target;
  }
  if (target.type === 'blog') {
    await prisma.blogPost.update({ where: { id: target.id }, data: { [target.fieldName]: output } });
    return target;
  }
  const template = (await getEditableEmailTemplates()).find((item) => item.key === target.id);
  if (!template) throw new Error('Target email template was not found.');
  await saveEmailTemplateOverride(
    target.id,
    target.fieldName === 'subject' ? output : template.subject,
    target.fieldName === 'html' ? output : template.html,
  );
  return target;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const action = field(form, '_action', 'rewrite');

    if (action === 'delete') {
      const id = field(form, 'id');
      if (!id) return fail('Rewrite request ID is required.', 422);
      await prisma.contentRewriteRequest.delete({ where: { id } });
      await audit({ actorId: user.id, action: 'content_rewrite.delete', entity: 'contentRewriteRequest', entityId: id });
      return redirect(req, '?deleted=1');
    }

    if (action === 'clear') {
      const result = await prisma.contentRewriteRequest.deleteMany({});
      await audit({ actorId: user.id, action: 'content_rewrite.clear', entity: 'contentRewriteRequest', metadata: { deleted: result.count } });
      return redirect(req, '?cleared=1');
    }

    if (action === 'apply') {
      const id = field(form, 'id');
      const targetRef = field(form, 'targetRef');
      const output = field(form, 'output');
      if (!id) return fail('Rewrite request ID is required.', 422);
      if (!targetRef) return fail('Target field is required.', 422);
      if (!output) return fail('Output text is required.', 422);
      const row = await prisma.contentRewriteRequest.findUnique({ where: { id } });
      if (!row) return fail('Rewrite request was not found.', 404);
      const target = await applyTargetText(targetRef, output);
      await prisma.contentRewriteRequest.update({ where: { id }, data: { output, status: 'APPLIED' } });
      await audit({
        actorId: user.id,
        action: 'content_rewrite.apply',
        entity: target.type,
        entityId: target.id,
        metadata: { rewriteRequestId: id, fieldName: target.fieldName, outputLength: output.length },
      });
      return redirect(req, '?applied=1');
    }

    const targetRef = field(form, 'targetRef');
    const input = field(form, 'input') || (targetRef ? await targetText(targetRef) : '');
    const tone = field(form, 'tone', 'professional') || 'professional';

    if (!input) return fail('Content is required.', 422);
    if (input.length > 12000) return fail('Content must be 12,000 characters or fewer.', 422);

    const output = await rewriteContent(input, tone);
    const row = await prisma.contentRewriteRequest.create({
      data: { userId: user.id, input, tone, output, status: output ? 'DONE' : 'FAILED' },
    });

    await audit({
      actorId: user.id,
      action: 'content_rewrite.create',
      entity: 'contentRewriteRequest',
      entityId: row.id,
      metadata: { tone, inputLength: input.length, outputLength: output.length, targetRef: targetRef || null },
    });

    return redirect(req, '?saved=1');
  } catch (error: any) {
    return handleRouteError(error, req, '/login');
  }
}
