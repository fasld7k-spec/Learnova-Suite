import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { awardAchievement } from '@/lib/achievements';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { isEnrolled } from '@/lib/enrollment';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const milestoneId = String(f.get('milestoneId') || '');
    const milestone = await prisma.courseMilestone.findUnique({ where: { id: milestoneId }, select: { id: true, courseId: true, title: true } });
    if (!milestone || !(await isEnrolled(user.id, milestone.courseId))) return fail('Milestone not found', 404);
    await prisma.milestoneProgress.upsert({
      where: { milestoneId_userId: { milestoneId: milestone.id, userId: user.id } },
      update: { completed: true },
      create: { milestoneId: milestone.id, userId: user.id, completed: true }
    });
    await awardAchievement({
      userId: user.id,
      title: 'Milestone Achieved',
      icon: 'flag',
      reason: milestone.title,
    });
    return NextResponse.redirect(new URL('/student/milestones', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
