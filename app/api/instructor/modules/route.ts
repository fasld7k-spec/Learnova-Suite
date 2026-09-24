import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const courseId = String(f.get('courseId'));
    const action = String(f.get('action') || 'create');
    const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: user.id } });
    if (!course) return fail('Course not found', 404);

    if (action === 'update') {
      const moduleId = String(f.get('moduleId') || '');
      const courseModule = await prisma.module.findFirst({ where: { id: moduleId, courseId } });
      if (!courseModule) return fail('Module not found', 404);
      await prisma.module.update({
        where: { id: courseModule.id },
        data: {
          title: String(f.get('title') || courseModule.title).trim() || courseModule.title,
          sortOrder: Number(f.get('sortOrder') || 0)
        }
      });
      return NextResponse.redirect(new URL(`/instructor/courses/${courseId}`, req.url), 303);
    }

    if (action === 'delete') {
      const moduleId = String(f.get('moduleId') || '');
      const courseModule = await prisma.module.findFirst({
        where: { id: moduleId, courseId },
        include: { lessons: { select: { id: true } } }
      });
      if (!courseModule) return fail('Module not found', 404);
      const lessonIds = courseModule.lessons.map((lesson) => lesson.id);
      if (lessonIds.length) {
        const quizzes = await prisma.quiz.findMany({ where: { lessonId: { in: lessonIds } }, select: { id: true } });
        const quizIds = quizzes.map((quiz) => quiz.id);
        if (quizIds.length) await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });
        await prisma.liveSession.updateMany({ where: { lessonId: { in: lessonIds } }, data: { lessonId: null } });
        await prisma.quiz.deleteMany({ where: { lessonId: { in: lessonIds } } });
        await prisma.assignment.deleteMany({ where: { lessonId: { in: lessonIds } } });
        await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } });
        await prisma.lessonBookmark.deleteMany({ where: { lessonId: { in: lessonIds } } });
      }
      await prisma.module.delete({ where: { id: courseModule.id } });
      return NextResponse.redirect(new URL(`/instructor/courses/${courseId}`, req.url), 303);
    }

    await prisma.module.create({
      data: {
        courseId,
        title: String(f.get('title') || '').trim(),
        sortOrder: Number(f.get('sortOrder') || 0)
      }
    });
    return NextResponse.redirect(new URL(`/instructor/courses/${courseId}`, req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
