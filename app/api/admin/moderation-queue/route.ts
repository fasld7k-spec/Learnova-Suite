import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/moderation-queue', req.url), 303);
}

async function applyModerationEffect(entity: string, entityId: string, action: string) {
  const normalizedEntity = entity.toLowerCase();
  let courseCatalogChanged = false;
  if (normalizedEntity === 'course') {
    if (action === 'APPROVED') {
      await prisma.course.update({ where: { id: entityId }, data: { status: 'PUBLISHED' } }).catch(() => null);
      courseCatalogChanged = true;
    } else if (action === 'REJECTED') {
      await prisma.course.update({ where: { id: entityId }, data: { status: 'REJECTED' } }).catch(() => null);
      courseCatalogChanged = true;
    }
  }
  if (normalizedEntity === 'user') {
    if (action === 'APPROVED') {
      await prisma.user.update({ where: { id: entityId }, data: { status: 'APPROVED' } }).catch(() => null);
    } else if (action === 'REJECTED') {
      await prisma.user.update({ where: { id: entityId }, data: { status: 'SUSPENDED' } }).catch(() => null);
    }
  }
  if (normalizedEntity === 'review' && action === 'REJECTED') {
    await prisma.review.delete({ where: { id: entityId } }).catch(() => null);
    courseCatalogChanged = true;
  }
  if (normalizedEntity === 'question' && action === 'REJECTED') {
    await prisma.question.update({
      where: { id: entityId },
      data: { title: 'Moderated question', body: 'This question was removed by moderation.' },
    }).catch(() => null);
  }
  return { courseCatalogChanged };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    const status = String(form.get('status') || '').trim().toUpperCase();
    const action = String(form.get('_action') || '').trim();
    if (!id) return fail('Moderation item id is required.', 422);

    const item = await prisma.moderationQueueItem.findUnique({ where: { id } });
    if (!item) return fail('Moderation item not found.', 404);

    if (action === 'delete') {
      await prisma.moderationQueueItem.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: 'moderation.delete',
        entity: item.entity,
        entityId: item.entityId,
        metadata: { moderationItemId: item.id, reason: item.reason, status: item.status },
      });
      return redirect(req);
    }

    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) return fail('Invalid moderation status.', 422);

    await prisma.moderationQueueItem.update({ where: { id }, data: { status } });
    if (status !== 'PENDING') {
      const effect = await applyModerationEffect(item.entity, item.entityId, status);
      if (effect.courseCatalogChanged) await invalidateCourseCatalogCache();
    }
    await audit({
      actorId: admin.id,
      action: 'moderation.status',
      entity: item.entity,
      entityId: item.entityId,
      metadata: { moderationItemId: item.id, status },
    });

    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Unable to update moderation item.', 500);
  }
}
