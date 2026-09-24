import { NextRequest, NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail, handleRouteError } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readRequiredField(form: FormData, key: string) {
  const value = String(form.get(key) || '').trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);

    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || 'save').trim();
    const id = String(form.get('id') || '').trim();

    if (action === 'delete') {
      if (!id) return fail('Article id is required.', 422);
      const article = await prisma.knowledgeBaseArticle.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'knowledge_base.delete', entity: 'KnowledgeBaseArticle', entityId: article.id, metadata: { slug: article.slug, title: article.title } });
      return NextResponse.redirect(new URL('/admin/knowledge-base', req.url), 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('Article id is required.', 422);
      const current = await prisma.knowledgeBaseArticle.findUnique({ where: { id } });
      if (!current) return fail('Article not found.', 404);
      const article = await prisma.knowledgeBaseArticle.update({ where: { id }, data: { published: !current.published } });
      await audit({ actorId: admin.id, action: article.published ? 'knowledge_base.publish' : 'knowledge_base.unpublish', entity: 'KnowledgeBaseArticle', entityId: article.id, metadata: { slug: article.slug } });
      return NextResponse.redirect(new URL('/admin/knowledge-base', req.url), 303);
    }

    const title = readRequiredField(form, 'title');
    const slug = readRequiredField(form, 'slug').toLowerCase();
    const category = readRequiredField(form, 'category');
    const body = readRequiredField(form, 'body');
    const published = form.get('published') === 'on';

    if (!slugPattern.test(slug)) {
      return fail('Slug must use lowercase letters, numbers, and hyphens only.', 422);
    }

    let article;
    if (action === 'update') {
      if (!id) return fail('Article id is required.', 422);
      article = await prisma.knowledgeBaseArticle.update({
        where: { id },
        data: { slug, title, category, body, published },
      });
      await audit({ actorId: admin.id, action: 'knowledge_base.update', entity: 'KnowledgeBaseArticle', entityId: article.id, metadata: { slug, published } });
      return NextResponse.redirect(new URL('/admin/knowledge-base', req.url), 303);
    }

    article = await prisma.knowledgeBaseArticle.upsert({
      where: { slug },
      update: { title, category, body, published },
      create: { slug, title, category, body, published }
    });
    await audit({ actorId: admin.id, action: 'knowledge_base.save', entity: 'KnowledgeBaseArticle', entityId: article.id, metadata: { slug, published } });

    return NextResponse.redirect(new URL('/admin/knowledge-base', req.url), 303);
  } catch (e: any) {
    if (e?.message?.endsWith('is required.')) return fail(e.message, 422);
    return handleRouteError(e, req, '/login');
  }
}
