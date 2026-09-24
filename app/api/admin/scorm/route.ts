import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';
import { verifyCsrf } from '@/lib/csrf';

function field(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = field(form, 'action') || 'save';
    const id = field(form, 'id');
    const redirectUrl = new URL('/admin/scorm', req.url);

    if (action === 'delete') {
      if (!id) return fail('SCORM package ID is required.', 422);
      await prisma.scormAttempt.deleteMany({ where: { packageId: id } });
      await prisma.scormPackage.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'scorm_package.delete', entity: 'ScormPackage', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('SCORM package ID is required.', 422);
      const scormPackage = await prisma.scormPackage.update({ where: { id }, data: { active: field(form, 'active') === 'true' } });
      await audit({ actorId: admin.id, action: scormPackage.active ? 'scorm_package.enable' : 'scorm_package.disable', entity: 'ScormPackage', entityId: id });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const courseId = field(form, 'courseId');
    const title = field(form, 'title');
    if (!courseId || title.length < 2) return fail('Course and package title are required.', 422);
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return fail('Course was not found.', 404);

    const data = {
      courseId,
      title,
      manifestUrl: validateStoredUrl(field(form, 'manifestUrl'), { label: 'Manifest URL', allowRelative: true }),
      launchUrl: validateStoredUrl(field(form, 'launchUrl'), { label: 'Launch URL', allowRelative: true }),
      active: form.get('active') === 'on',
    };
    if (!data.manifestUrl || !data.launchUrl) return fail('Manifest and launch URLs are required.', 422);

    if (id) {
      await prisma.scormPackage.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'scorm_package.update', entity: 'ScormPackage', entityId: id });
    } else {
      const scormPackage = await prisma.scormPackage.create({ data });
      await audit({ actorId: admin.id, action: 'scorm_package.create', entity: 'ScormPackage', entityId: scormPackage.id });
    }
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error: any) {
    return fail(error.message, /required|valid|URL|not found|ID/i.test(error.message) ? 422 : 500);
  }
}
