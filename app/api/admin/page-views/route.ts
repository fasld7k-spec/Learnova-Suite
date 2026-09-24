import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function olderThan(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();

    if (action === 'purge-old') {
      const days = Math.max(1, Math.round(Number(form.get('days') || 90)));
      const result = await prisma.pageView.deleteMany({ where: { createdAt: { lt: olderThan(days) } } });
      await audit({ actorId: admin.id, action: 'page_view.purge_old', entity: 'pageView', metadata: { days, deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/page-views?purged=1', req.url), 303);
    }

    if (action === 'delete') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('Page view ID is required.', 422);
      const row = await prisma.pageView.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'page_view.delete', entity: 'pageView', entityId: row.id, metadata: { path: row.path } });
      return NextResponse.redirect(new URL('/admin/page-views?deleted=1', req.url), 303);
    }

    return fail('Unsupported page view action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Page view action failed.', 500);
  }
}
