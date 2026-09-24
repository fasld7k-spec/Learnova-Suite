import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

async function writePrivacyFile(fileName: string, payload: unknown) {
  const dir = path.join(process.cwd(), 'public', 'exports', 'privacy');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), JSON.stringify(payload, null, 2), 'utf8');
  return `/exports/privacy/${fileName}`;
}

export async function completeDataExportRequest(requestId: string, adminId: string) {
  const request = await prisma.dataExportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Data export request not found.');

  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      bio: true,
      locale: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) throw new Error('User not found.');

  const [
    enrollments,
    orders,
    certificates,
    reviews,
    questions,
    lessonProgress,
    notifications,
    favorites,
    collections,
    savedSearches,
    devices,
    conversations,
    sentMessages,
  ] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId: user.id }, include: { course: { select: { title: true, slug: true } } } }),
    prisma.order.findMany({ where: { userId: user.id }, include: { items: true, payment: true } }),
    prisma.certificate.findMany({ where: { userId: user.id } }),
    prisma.review.findMany({ where: { userId: user.id } }),
    prisma.question.findMany({ where: { userId: user.id } }),
    prisma.lessonProgress.findMany({ where: { userId: user.id } }),
    prisma.notification.findMany({ where: { userId: user.id } }),
    prisma.favorite.findMany({ where: { userId: user.id } }),
    prisma.courseCollection.findMany({ where: { userId: user.id } }),
    prisma.savedSearch.findMany({ where: { userId: user.id } }),
    prisma.userDevice.findMany({ where: { userId: user.id } }),
    prisma.conversation.findMany({
      where: { userIds: { contains: JSON.stringify(user.id) } },
      select: {
        id: true,
        subject: true,
        userIds: true,
        createdAt: true,
        messages: {
          select: { id: true, senderId: true, body: true, read: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.message.findMany({
      where: { senderId: user.id },
      select: { id: true, conversationId: true, senderId: true, body: true, read: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const fileUrl = await writePrivacyFile(`data-export-${user.id}-${Date.now()}.json`, {
    exportedAt: new Date().toISOString(),
    requestedAt: request.createdAt,
    fulfilledBy: adminId,
    user,
    enrollments,
    orders,
    certificates,
    reviews,
    questions,
    lessonProgress,
    notifications,
    favorites,
    collections,
    savedSearches,
    devices,
    conversations,
    sentMessages,
  });

  await prisma.dataExportRequest.update({ where: { id: request.id }, data: { status: 'DONE', fileUrl } });
  await prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Your data export is ready',
      body: 'An administrator has prepared your account data export.',
    },
  }).catch(() => null);

  return { fileUrl };
}

export async function rejectDataExportRequest(requestId: string, reason: string) {
  const request = await prisma.dataExportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Data export request not found.');
  await prisma.dataExportRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
  await prisma.notification.create({
    data: {
      userId: request.userId,
      title: 'Data export request rejected',
      body: reason || 'Your data export request could not be completed.',
    },
  }).catch(() => null);
}

export async function completeDataDeletionRequest(requestId: string, adminId: string) {
  const request = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Data deletion request not found.');
  const user = await prisma.user.findUnique({ where: { id: request.userId }, select: { id: true, email: true, role: true } });
  if (!user) throw new Error('User not found.');
  if (user.role === 'ADMIN') throw new Error('Admin accounts cannot be privacy-deleted from this workflow.');

  const anonymizedEmail = `deleted-${user.id}-${randomBytes(4).toString('hex')}@privacy.local`;
  await prisma.$transaction([
    prisma.oAuthAccount.deleteMany({ where: { userId: user.id } }),
    prisma.twoFactorAuth.deleteMany({ where: { userId: user.id } }),
    prisma.userDevice.deleteMany({ where: { userId: user.id } }),
    prisma.savedSearch.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.courseCollection.updateMany({ where: { userId: user.id }, data: { title: 'Deleted user collection', courseIds: '[]' } }),
    prisma.review.updateMany({ where: { userId: user.id }, data: { comment: null } }),
    prisma.question.updateMany({ where: { userId: user.id }, data: { title: 'Deleted user question', body: 'Deleted by privacy request.' } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: 'Deleted User',
        email: anonymizedEmail,
        passwordHash: randomBytes(32).toString('hex'),
        avatar: null,
        bio: null,
        status: 'SUSPENDED',
        passwordChangedAt: new Date(),
      },
    }),
    prisma.dataDeletionRequest.update({ where: { id: request.id }, data: { status: 'DONE' } }),
    prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'privacy.delete.complete',
        entity: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ requestId: request.id, anonymizedEmail }),
      },
    }),
  ]);

  return { anonymizedEmail };
}

export async function rejectDataDeletionRequest(requestId: string, reason: string) {
  const request = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Data deletion request not found.');
  await prisma.dataDeletionRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
  await prisma.notification.create({
    data: {
      userId: request.userId,
      title: 'Account deletion request rejected',
      body: reason || 'Your account deletion request could not be completed.',
    },
  }).catch(() => null);
}
