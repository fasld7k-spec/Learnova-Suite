import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { generateCourseOutline } from '@/lib/ai';
import { requireApprovedInstructor } from '@/lib/auth';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

type Outline = {
  title?: string;
  modules?: { title: string; lessons: string[] }[];
  outcomes?: string[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `ai-course-${Date.now()}`;
}

async function uniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.course.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const action = String(form.get('action') || 'generate');
    if (action === 'create-course') {
      const idea = await prisma.aICourseIdea.findFirst({
        where: { id: String(form.get('ideaId') || ''), userId: user.id }
      });
      if (!idea) return fail('AI course idea not found.', 404);
      const category = await prisma.category.findFirst({ orderBy: { nameEn: 'asc' }, select: { id: true } });
      if (!category) return fail('Create at least one category before turning AI ideas into courses.', 422);
      const outline = fromJsonObject<Outline>(idea.outline);
      const title = String(outline.title || idea.prompt || 'AI generated course').trim().slice(0, 140);
      const slug = await uniqueSlug(slugify(title));
      const course = await prisma.course.create({
        data: {
          title,
          slug,
          shortDescription: `Draft generated from AI idea: ${idea.prompt}`.slice(0, 300),
          fullDescription: [
            `This draft was generated from the instructor AI course idea workflow.`,
            `Original prompt: ${idea.prompt}`,
            outline.outcomes?.length ? `Suggested outcomes: ${outline.outcomes.join(', ')}` : ''
          ].filter(Boolean).join('\n\n'),
          categoryId: category.id,
          instructorId: user.id,
          status: 'DRAFT',
          price: 0,
          isFree: true,
          includesCertificate: true,
          requirements: toJson(['Review and customize the generated outline before publishing.']),
          outcomes: toJson(outline.outcomes || []),
          targetAudience: toJson(['Learners interested in this generated course topic.']),
          modules: outline.modules?.length
            ? {
                create: outline.modules.map((module, moduleIndex) => ({
                  title: module.title || `Module ${moduleIndex + 1}`,
                  sortOrder: moduleIndex,
                  lessons: module.lessons?.length
                    ? {
                        create: module.lessons.map((lesson, lessonIndex) => ({
                          title: lesson || `Lesson ${lessonIndex + 1}`,
                          type: 'TEXT',
                          content: 'Replace this generated draft lesson with your final lesson text, video, quiz, assignment, or live session.',
                          durationMinutes: 10,
                          sortOrder: lessonIndex,
                        }))
                      }
                    : undefined
                }))
              }
            : undefined
        }
      });
      await invalidateCourseCatalogCache();
      return NextResponse.redirect(new URL(`/instructor/courses/${course.id}?aiDraft=1`, req.url), 303);
    }

    const prompt = String(form.get('prompt') || '').trim();
    if (!prompt) return fail('Prompt is required.', 422);

    const outline = await generateCourseOutline(prompt);
    await prisma.aICourseIdea.create({ data: { userId: user.id, prompt, outline: toJson(outline) } });
    return NextResponse.redirect(new URL('/instructor/ai-course-ideas', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
