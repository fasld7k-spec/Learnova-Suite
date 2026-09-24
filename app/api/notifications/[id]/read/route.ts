/**
 * POST /api/notifications/[id]/read
 *
 * Marks a specific notification as read.
 * Returns HTTP 403 if the notification does not belong to the authenticated user.
 *
 * Requirements: 4.5, 4.7
 */

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';

async function csrfTokenFromRequest(req: NextRequest) {
  const headerToken = req.headers.get('x-csrf-token') || '';
  if (headerToken) return headerToken;
  const body = await req.json().catch(() => ({}));
  return typeof body.csrfToken === 'string' ? body.csrfToken : '';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return fail('Unauthenticated', 401);
  }
  if (!(await verifyCsrf(await csrfTokenFromRequest(req)))) return fail('Invalid CSRF token.', 403);

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!notification) {
    return fail('Notification not found', 404);
  }

  // Requirement 4.7: return 403 if notification does not belong to the user
  if (notification.userId !== session.id) {
    return fail('Forbidden', 403);
  }

  await prisma.notification.updateMany({
    where: { id, userId: session.id },
    data: { read: true },
  });

  return ok({ read: true });
}
