import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { toList } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/career-tracks', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function lines(raw: string) {
  return raw.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Career track id is required.', 422);
      await prisma.careerTrackEnrollment.deleteMany({ where: { careerTrackId: id } });
      await prisma.careerTrack.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'career_track.delete', entity: 'CareerTrack', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Career track id is required.', 422);
      const current = await prisma.careerTrack.findUnique({ where: { id } });
      if (!current) return fail('Career track not found.', 404);
      await prisma.careerTrack.update({ where: { id }, data: { active: !current.active } });
      return redirect(req);
    }

    const title = value(form, 'title');
    const slug = slugify(value(form, 'slug') || title);
    const description = value(form, 'description');
    if (title.length < 2) return fail('Career track title is required.', 422);
    if (slug.length < 2) return fail('Career track slug is required.', 422);
    if (description.length < 5) return fail('Career track description is required.', 422);

    const data = {
      title,
      slug,
      description,
      skillIds: toList(lines(value(form, 'skillIds'))),
      active: form.get('active') === 'on',
    };

    if (action === 'update') {
      if (!id) return fail('Career track id is required.', 422);
      await prisma.careerTrack.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'career_track.update', entity: 'CareerTrack', entityId: id });
      return redirect(req);
    }

    const row = await prisma.careerTrack.upsert({ where: { slug }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'career_track.upsert', entity: 'CareerTrack', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Career track update failed.', 500);
  }
}
