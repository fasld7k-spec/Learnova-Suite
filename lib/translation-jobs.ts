import { translateContent } from '@/lib/ai';
import { prisma } from '@/lib/prisma';

export async function processTranslationJob(jobId: string) {
  const job = await prisma.translationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Translation job not found.');

  try {
    await prisma.translationJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });

    if (job.entity === 'course') {
      const course = await prisma.course.findUnique({ where: { id: job.entityId } });
      if (!course) throw new Error('Course not found.');
      const [title, shortDescription, fullDescription] = await Promise.all([
        translateContent(course.title, job.locale),
        translateContent(course.shortDescription, job.locale),
        translateContent(course.fullDescription, job.locale),
      ]);
      const needsReview = title.needsReview || shortDescription.needsReview || fullDescription.needsReview;
      if (!needsReview) {
        await prisma.courseTranslation.upsert({
          where: { courseId_locale: { courseId: course.id, locale: job.locale } },
          update: {
            title: title.text,
            shortDescription: shortDescription.text,
            fullDescription: fullDescription.text,
          },
          create: {
            courseId: course.id,
            locale: job.locale,
            title: title.text,
            shortDescription: shortDescription.text,
            fullDescription: fullDescription.text,
          },
        });
      }
      await prisma.translationJob.update({
        where: { id: job.id },
        data: {
          status: needsReview ? 'NEEDS_REVIEW' : 'DONE',
          result: JSON.stringify({
            courseId: course.id,
            locale: job.locale,
            title: title.text,
            shortDescription: shortDescription.text,
            fullDescription: fullDescription.text,
            provider: title.provider,
            needsReview,
            appliedToCourse: !needsReview,
          }),
        },
      });
      return { status: needsReview ? 'NEEDS_REVIEW' : 'DONE' };
    }

    if (job.entity === 'page') {
      const page = await prisma.page.findUnique({ where: { id: job.entityId } });
      if (!page) throw new Error('Page not found.');
      const [title, body] = await Promise.all([
        translateContent(page.titleEn, job.locale),
        translateContent(page.bodyEn, job.locale),
      ]);
      const needsReview = title.needsReview || body.needsReview || job.locale !== 'ar';
      if (!needsReview && job.locale === 'ar') {
        await prisma.page.update({ where: { id: page.id }, data: { titleAr: title.text, bodyAr: body.text } });
      }
      await prisma.translationJob.update({
        where: { id: job.id },
        data: {
          status: needsReview ? 'NEEDS_REVIEW' : 'DONE',
          result: JSON.stringify({ title: title.text, body: body.text, provider: title.provider, appliedToPage: job.locale === 'ar', needsReview }),
        },
      });
      return { status: needsReview ? 'NEEDS_REVIEW' : 'DONE' };
    }

    if (job.entity === 'blog') {
      const post = await prisma.blogPost.findUnique({ where: { id: job.entityId } });
      if (!post) throw new Error('Blog post not found.');
      const [title, excerpt, content] = await Promise.all([
        translateContent(post.title, job.locale),
        translateContent(post.excerpt, job.locale),
        translateContent(post.content, job.locale),
      ]);
      const needsReview = title.needsReview || excerpt.needsReview || content.needsReview;
      await prisma.translationJob.update({
        where: { id: job.id },
        data: {
          status: 'NEEDS_REVIEW',
          result: JSON.stringify({ title: title.text, excerpt: excerpt.text, content: content.text, provider: title.provider, needsReview }),
        },
      });
      return { status: 'NEEDS_REVIEW' };
    }

    throw new Error('Unsupported translation entity.');
  } catch (error: any) {
    await prisma.translationJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', result: JSON.stringify({ error: error.message || 'Translation failed' }) },
    }).catch(() => null);
    throw error;
  }
}
