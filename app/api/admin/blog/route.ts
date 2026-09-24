import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/blog', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Post id is required.', 422);
      await prisma.blogPost.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'blog.delete', entity: 'BlogPost', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Post id is required.', 422);
      const current = await prisma.blogPost.findUnique({ where: { id } });
      if (!current) return fail('Post not found.', 404);
      const post = await prisma.blogPost.update({ where: { id }, data: { published: !current.published } });
      await audit({ actorId: admin.id, action: post.published ? 'blog.publish' : 'blog.unpublish', entity: 'BlogPost', entityId: post.id, metadata: { slug: post.slug } });
      return redirect(req);
    }

    const title = value(form, 'title');
    const slug = slugify(value(form, 'slug') || title);
    const excerpt = value(form, 'excerpt');
    const content = value(form, 'content');
    const coverImage = validateStoredUrl(value(form, 'coverImage'), { label: 'Cover image URL', allowRelative: true }) || null;
    const published = form.get('published') === 'on';
    if (title.length < 2) return fail('Post title is required.', 422);
    if (slug.length < 2) return fail('Post slug is required.', 422);
    if (excerpt.length < 10) return fail('Post excerpt is too short.', 422);
    if (content.length < 20) return fail('Post content is too short.', 422);

    const data = { title, slug, excerpt, content, coverImage, published };
    if (action === 'update') {
      if (!id) return fail('Post id is required.', 422);
      await prisma.blogPost.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'blog.update', entity: 'BlogPost', entityId: id });
      return redirect(req);
    }

    const post = await prisma.blogPost.upsert({ where: { slug }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'blog.upsert', entity: 'BlogPost', entityId: post.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Blog update failed.', 500);
  }
}
