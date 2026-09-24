import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { processTranslationJob } from '@/lib/translation-jobs';

const allowedEntities = ['course', 'page', 'blog'];

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/admin/translation-jobs', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

async function resolveEntityId(entity: string, reference: string) {
  if (entity === 'course') {
    const course = await prisma.course.findFirst({ where: { OR: [{ id: reference }, { slug: reference }] }, select: { id: true } });
    return course?.id;
  }
  if (entity === 'page') {
    const page = await prisma.page.findFirst({ where: { OR: [{ id: reference }, { slug: reference }] }, select: { id: true } });
    return page?.id;
  }
  if (entity === 'blog') {
    const post = await prisma.blogPost.findFirst({ where: { OR: [{ id: reference }, { slug: reference }] }, select: { id: true } });
    return post?.id;
  }
  return null;
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function applyReviewedTranslation(jobId: string, form: FormData) {
  const job = await prisma.translationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Translation job not found.');
  const result = fromJsonObject<Record<string, string>>(job.result);

  if (job.entity === 'course') {
    const title = value(form, 'title') || result.title;
    const shortDescription = value(form, 'shortDescription') || result.shortDescription;
    const fullDescription = value(form, 'fullDescription') || result.fullDescription;
    if (!title || !shortDescription || !fullDescription) throw new Error('Course title, short description, and full description are required.');
    await prisma.courseTranslation.upsert({
      where: { courseId_locale: { courseId: job.entityId, locale: job.locale } },
      update: { title, shortDescription, fullDescription },
      create: { courseId: job.entityId, locale: job.locale, title, shortDescription, fullDescription },
    });
    await prisma.translationJob.update({
      where: { id: job.id },
      data: { status: 'DONE', result: JSON.stringify({ ...result, title, shortDescription, fullDescription, needsReview: false, appliedAt: new Date().toISOString() }) },
    });
    return;
  }

  if (job.entity === 'page') {
    const title = value(form, 'title') || result.title;
    const body = value(form, 'body') || result.body;
    if (!title || !body) throw new Error('Page title and body are required.');
    if (job.locale !== 'ar') throw new Error('This project stores page translations in Arabic fields only. Use Arabic locale to apply page drafts.');
    await prisma.page.update({ where: { id: job.entityId }, data: { titleAr: title, bodyAr: body } });
    await prisma.translationJob.update({
      where: { id: job.id },
      data: { status: 'DONE', result: JSON.stringify({ ...result, title, body, needsReview: false, appliedToPage: true, appliedAt: new Date().toISOString() }) },
    });
    return;
  }

  if (job.entity === 'blog') {
    const title = value(form, 'title') || result.title;
    const excerpt = value(form, 'excerpt') || result.excerpt;
    const content = value(form, 'content') || result.content;
    if (!title || !excerpt || !content) throw new Error('Blog title, excerpt, and content are required.');
    await prisma.blogPost.update({ where: { id: job.entityId }, data: { title, excerpt, content } });
    await prisma.translationJob.update({
      where: { id: job.id },
      data: { status: 'DONE', result: JSON.stringify({ ...result, title, excerpt, content, needsReview: false, appliedToBlog: true, appliedAt: new Date().toISOString() }) },
    });
    return;
  }

  throw new Error('Unsupported translation entity.');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create').trim();
    const id = String(form.get('id') || '').trim();

    if (action === 'retry') {
      if (!id) return formError(req, 'Translation job id is required.');
      await prisma.translationJob.update({ where: { id }, data: { status: 'PENDING', result: null } });
      await processTranslationJob(id);
      await audit({ actorId: admin.id, action: 'translation_job.retry', entity: 'TranslationJob', entityId: id });
      return NextResponse.redirect(new URL('/admin/translation-jobs?retried=1', req.url), 303);
    }

    if (action === 'apply') {
      if (!id) return formError(req, 'Translation job id is required.');
      await applyReviewedTranslation(id, form);
      await audit({ actorId: admin.id, action: 'translation_job.apply', entity: 'TranslationJob', entityId: id });
      return NextResponse.redirect(new URL('/admin/translation-jobs?applied=1', req.url), 303);
    }

    if (action === 'delete') {
      if (!id) return formError(req, 'Translation job id is required.');
      await prisma.translationJob.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'translation_job.delete', entity: 'TranslationJob', entityId: id });
      return NextResponse.redirect(new URL('/admin/translation-jobs?deleted=1', req.url), 303);
    }

    const entity = String(form.get('entity') || '').trim().toLowerCase();
    const reference = String(form.get('entityId') || '').trim();
    const locale = String(form.get('locale') || '').trim().toLowerCase();

    if (!allowedEntities.includes(entity)) return formError(req, 'Unsupported content type.');
    if (!reference) return formError(req, 'Content reference is required.');
    if (!locale) return formError(req, 'Target locale is required.');

    const entityId = await resolveEntityId(entity, reference);
    if (!entityId) return formError(req, 'Content was not found for this reference.', 404);

    const job = await prisma.translationJob.create({ data: { entity, entityId, locale, status: 'PENDING' } });
    await processTranslationJob(job.id);
    await audit({ actorId: admin.id, action: 'translation_job.create', entity: 'TranslationJob', entityId: job.id, metadata: { entity, entityId, locale } });
    return NextResponse.redirect(new URL('/admin/translation-jobs', req.url), 303);
  } catch (e: any) {
    return formError(req, e.message || 'Unable to create translation job.', 500);
  }
}
