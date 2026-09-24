import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = String(req.nextUrl.searchParams.get('token') || '').trim();
  if (!token) return NextResponse.redirect(new URL('/courses?error=missing-invite', req.url), 303);

  const invite = await prisma.bulkEnrollmentInvite.findUnique({ where: { token } });
  if (!invite || invite.status !== 'PENDING') return NextResponse.redirect(new URL('/courses?error=invalid-invite', req.url), 303);

  const session = await getSession();
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', `/api/enrollment-invites/accept?token=${encodeURIComponent(token)}`);
    return NextResponse.redirect(loginUrl, 303);
  }
  if (session.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.redirect(new URL('/courses?error=invite-email-mismatch', req.url), 303);
  }

  const course = await prisma.course.findUnique({ where: { id: invite.courseId }, select: { id: true, slug: true, title: true } });
  if (!course) return NextResponse.redirect(new URL('/courses?error=course-not-found', req.url), 303);

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.id, courseId: course.id } },
    update: {},
    create: { userId: session.id, courseId: course.id, progress: 0 },
  });
  await prisma.bulkEnrollmentInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });

  return NextResponse.redirect(new URL(`/learn/${course.slug}`, req.url), 303);
}
