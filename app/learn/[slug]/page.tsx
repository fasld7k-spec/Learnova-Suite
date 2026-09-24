import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Bookmark, CheckCircle2, FileText, LockKeyhole, MessageCircle, PlayCircle, SquareCheckBig } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { SecureLessonViewer } from '@/components/learn/SecureLessonViewer';
import { StudentNotesClient } from '@/components/learn/StudentNotesClient';
import { getSession } from '@/lib/auth';
import { createLessonMediaAccessUrl, getContentProtectionSettings } from '@/lib/content-protection';
import { getCsrfToken } from '@/lib/csrf';
import { localizedPageCopy } from '@/lib/page-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { generateSignedEmbedUrl } from '@/lib/video-providers';

function isBunnyEmbedUrl(url: string | null) {
  return Boolean(url && /iframe\.mediadelivery\.net\/embed\//i.test(url));
}

function signedBunnyUrl(videoAsset: { provider: string; externalId: string } | null | undefined, fallbackUrl: string | null) {
  if (videoAsset?.provider === 'bunny' && videoAsset.externalId) {
    try {
      return generateSignedEmbedUrl(videoAsset.externalId, 3600);
    } catch {
      return fallbackUrl;
    }
  }
  return fallbackUrl;
}

export default async function Learn(
  props: { params: Promise<{ slug: string }>; searchParams?: Promise<{ lesson?: string; preview?: string; error?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.id } }) : null;
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    include: {
      modules: {
        include: { lessons: { include: { videoAsset: true }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] } },
        orderBy: { sortOrder: 'asc' }
      },
      enrollments: { where: { userId: user?.id || '__guest__' } }
    }
  });

  if (!course) notFound();

  const lessons = course.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title })));
  const isAdmin = user?.role === 'ADMIN';
  const isCourseInstructor = user?.role === 'INSTRUCTOR' && course.instructorId === user.id;
  if (course.status !== 'PUBLISHED' && !isAdmin && !isCourseInstructor) notFound();
  const isEnrolledStudent = user?.role === 'STUDENT' && course.enrollments.length > 0;
  const hasFullAccess = isAdmin || isCourseInstructor || isEnrolledStudent;
  const enrollment = course.enrollments[0];
  const dripRows = lessons.length
    ? await prisma.dripSchedule.findMany({
        where: { courseId: course.id, lessonId: { in: lessons.map((lesson) => lesson.id) } },
        orderBy: { createdAt: 'desc' }
      })
    : [];
  const dripByLessonId = new Map<string, (typeof dripRows)[number]>();
  for (const row of dripRows) {
    if (!dripByLessonId.has(row.lessonId)) dripByLessonId.set(row.lessonId, row);
  }
  const now = new Date();
  const unlockDateFor = (lesson: { id: string; isPreview: boolean }) => {
    if (!isEnrolledStudent || isCourseInstructor || isAdmin || lesson.isPreview || !enrollment) return null;
    const schedule = dripByLessonId.get(lesson.id);
    if (!schedule || schedule.unlockDay <= 0) return null;
    const unlockAt = new Date(enrollment.createdAt);
    unlockAt.setDate(unlockAt.getDate() + schedule.unlockDay);
    return unlockAt;
  };
  const isDripUnlocked = (lesson: { id: string; isPreview: boolean }) => {
    const unlockAt = unlockDateFor(lesson);
    return !unlockAt || unlockAt <= now;
  };
  const canOpenLesson = (lesson: { id: string; isPreview: boolean }) => (hasFullAccess || lesson.isPreview) && isDripUnlocked(lesson);
  const isLessonVisible = (lesson: { id: string; isPreview: boolean }) => {
    if (!isEnrolledStudent || isCourseInstructor || isAdmin || lesson.isPreview) return true;
    return isDripUnlocked(lesson);
  };
  const visibleLessons = lessons.filter(isLessonVisible);
  const progressRows = user
    ? await prisma.lessonProgress.findMany({
        where: { userId: user.id, lessonId: { in: lessons.map((lesson) => lesson.id) } }
      })
    : [];
  const completedLessonIds = new Set(progressRows.filter((row) => row.completed).map((row) => row.lessonId));
  const requestedLesson = lessons.find((lesson) => lesson.id === searchParams?.lesson);
  const fallbackLesson = visibleLessons.find(canOpenLesson) || visibleLessons.find((lesson) => lesson.isPreview) || visibleLessons[0];
  const selectedLesson = requestedLesson && isLessonVisible(requestedLesson) && canOpenLesson(requestedLesson)
    ? requestedLesson
    : fallbackLesson;
  const selectedVisibleIndex = selectedLesson ? visibleLessons.findIndex((lesson) => lesson.id === selectedLesson.id) : -1;
  const previousLesson = selectedVisibleIndex > 0 ? visibleLessons[selectedVisibleIndex - 1] : undefined;
  const nextLesson = selectedVisibleIndex >= 0 ? visibleLessons[selectedVisibleIndex + 1] : undefined;
  const canAccessSelectedLesson = Boolean(selectedLesson && canOpenLesson(selectedLesson));
  const canTrackProgress = Boolean(user?.role === 'STUDENT' && isEnrolledStudent && canAccessSelectedLesson);
  const [quizzes, assignmentRows, liveSessionRows, siteSettings, protectionSettings, csrfToken, noteRows, lessonQuestions] = await Promise.all([
    selectedLesson && canAccessSelectedLesson ? prisma.quiz.findMany({ where: { lessonId: selectedLesson.id }, select: { id: true, title: true } }) : Promise.resolve([]),
    selectedLesson && canAccessSelectedLesson
      ? prisma.assignment.findMany({
          where: { courseId: course.id, lessonId: selectedLesson.id },
          orderBy: { dueAt: 'asc' },
          take: 3,
          select: { id: true, lessonId: true, title: true, dueAt: true }
        })
      : Promise.resolve([]),
    selectedLesson && canAccessSelectedLesson
      ? prisma.liveSession.findMany({
          where: {
            startsAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
            lessonId: selectedLesson.id
          },
          orderBy: { startsAt: 'asc' },
          select: { id: true, lessonId: true, title: true, startsAt: true, provider: true, url: true }
        })
      : Promise.resolve([]),
    getSiteSettings(),
    getContentProtectionSettings(),
    getCsrfToken(),
    user?.role === 'STUDENT' && isEnrolledStudent
      ? prisma.courseNote.findMany({
          where: { userId: user.id, courseId: course.id },
          orderBy: { updatedAt: 'desc' }
        })
      : Promise.resolve([]),
    selectedLesson && canAccessSelectedLesson
      ? prisma.question.findMany({
          where: { courseId: course.id, lessonId: selectedLesson.id },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 8
        })
      : Promise.resolve([])
  ]);
  const assignments = selectedLesson?.type === 'ASSIGNMENT' ? assignmentRows : [];
  const liveSessions = selectedLesson?.type === 'LIVE' ? liveSessionRows : [];
  const selectedLessonProgress = selectedLesson ? progressRows.find((row) => row.lessonId === selectedLesson.id) : null;
  const watermarkLogoUrl = protectionSettings.watermarkLogoUrl || siteSettings.logoUrl || siteSettings.faviconUrl || '/icon.svg';
  const copy = localizedPageCopy(siteSettings.defaultLanguage).learn;
  const protectedViewerUserId = user?.id || (selectedLesson?.isPreview ? 'preview' : '');
  const selectedLessonMedia = selectedLesson && canAccessSelectedLesson
    ? protectedViewerUserId
      ? {
        ...selectedLesson,
        videoUrl: isBunnyEmbedUrl(selectedLesson.videoUrl)
          ? signedBunnyUrl(selectedLesson.videoAsset, selectedLesson.videoUrl)
          : await createLessonMediaAccessUrl({
              userId: protectedViewerUserId,
              courseId: course.id,
              lessonId: selectedLesson.id,
              kind: 'lesson-video',
              url: selectedLesson.videoUrl
            }),
        attachmentUrl: await createLessonMediaAccessUrl({
          userId: protectedViewerUserId,
          courseId: course.id,
          lessonId: selectedLesson.id,
          kind: 'lesson-attachment',
          url: selectedLesson.attachmentUrl
        })
      }
      : selectedLesson
    : null;
  const done = completedLessonIds.size;
  const progress = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const lessonHref = (lesson: { id: string; isPreview: boolean }) =>
    canOpenLesson(lesson) ? `/learn/${course.slug}?lesson=${lesson.id}${lesson.isPreview ? '&preview=1' : ''}` : `/courses/${course.slug}#enroll`;
  const noteModels = noteRows.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  }));
  const noteLessonOptions = visibleLessons.map((lesson) => ({ id: lesson.id, title: lesson.title, courseId: course.id }));

  return (
    <main className="moe-page grid min-h-screen text-white lg:grid-cols-[300px_minmax(0,1fr)_280px] xl:grid-cols-[330px_minmax(0,1fr)_300px]">
      <aside className="moe-sidebar border-b p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-5">
        <a className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white" href={`/courses/${course.slug}`}>
          <ArrowLeft size={16} />
          {copy.coursePage}
        </a>
        <h1 className="mt-4 text-lg font-black leading-tight sm:text-xl">{course.title}</h1>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-bold text-[#71767B]">
            <span>{copy.complete}</span>
            <span>{done}/{lessons.length}</span>
          </div>
          <div className="moe-progress mt-2">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-6 max-h-[44vh] overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible lg:pr-0">
          {course.modules.map((module) => (
            <div key={module.id} className="border-t border-[#2F3336] py-5">
              <b className="text-sm text-white">{module.title}</b>
              <div className="mt-3 grid gap-2">
                {module.lessons.map((lesson) => {
                  if (!isLessonVisible(lesson)) return null;
                  const isActive = selectedLesson?.id === lesson.id;
                  const isDone = completedLessonIds.has(lesson.id);
                  const lessonUnlocked = canOpenLesson(lesson);

                  return (
                    <Link
                      key={lesson.id}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm font-bold transition ${
                        isActive ? 'bg-violet-600/45 text-white' : lessonUnlocked ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-white/5'
                      }`}
                      href={lessonHref(lesson)}
                    >
                      {isDone ? (
                        <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-300" />
                      ) : lessonUnlocked ? (
                        <PlayCircle size={17} className="mt-0.5 shrink-0" />
                      ) : (
                        <LockKeyhole size={17} className="mt-0.5 shrink-0" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate">{lesson.title}</span>
                        <span className="block text-xs font-semibold text-slate-500">
                          {lesson.type} / {lesson.durationMinutes || 0} min{lesson.isPreview ? ` / ${copy.freePreview}` : ''}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 p-4 sm:p-5 lg:p-8">
        {searchParams?.error ? (
          <div className="mb-5 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">
            {searchParams.error}
          </div>
        ) : null}
        {selectedLesson ? (
          <>
            <div className="flex flex-col gap-4 border-b border-violet-300/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-violet-300">{selectedLesson.moduleTitle}</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">{selectedLesson.title}</h2>
              </div>
              {canTrackProgress ? (
                <form action="/api/student/progress" method="post" className="w-full sm:w-auto">
                  <CsrfInput />
                  <input type="hidden" name="lessonId" value={selectedLesson.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="redirect" value={`/learn/${course.slug}?lesson=${selectedLesson.id}`} />
                  <button className="btn-primary w-full sm:w-auto">
                    <SquareCheckBig size={17} />
                    {copy.markComplete}
                  </button>
                </form>
              ) : selectedLesson.isPreview ? (
                <a className="btn-primary w-full sm:w-auto" href={`/courses/${course.slug}#enroll`}>
                  {copy.unlockFullCourse}
                  <ArrowRight size={17} />
                </a>
              ) : (
                <a className="btn-secondary w-full sm:w-auto" href={`/courses/${course.slug}#enroll`}>
                  <LockKeyhole size={17} />
                  {copy.enrollToUnlock}
                </a>
              )}
            </div>

            <div className="moe-video-frame mt-6 overflow-hidden rounded-xl p-2">
              {canAccessSelectedLesson && selectedLessonMedia ? (
                <SecureLessonViewer
                  lesson={selectedLessonMedia}
                  watermarkLabel={user?.email || (selectedLesson.isPreview ? 'Free preview' : course.title)}
                  watermarkLogoUrl={watermarkLogoUrl}
                  watermarkEnabled={protectionSettings.watermarkDownloads}
                  csrfToken={csrfToken}
                  tracking={{
                    enabled: canTrackProgress && selectedLesson.type === 'VIDEO',
                    courseId: course.id,
                    lessonId: selectedLesson.id,
                    initialWatchSeconds: selectedLessonProgress?.watchSeconds || 0,
                    durationSeconds: (selectedLesson.durationMinutes || 0) * 60
                  }}
                  quizzes={quizzes}
                  assignments={assignments.map((assignment) => ({
                    ...assignment,
                    dueAt: assignment.dueAt?.toISOString() || null
                  }))}
                  liveSessions={liveSessions.map((session) => ({
                    ...session,
                    startsAt: session.startsAt.toISOString()
                  }))}
                />
              ) : (
                <div className="grid min-h-[45vh] place-items-center rounded-lg border border-violet-300/15 bg-black/30 p-8 text-center">
                  <div>
                    <LockKeyhole className="mx-auto text-violet-300" size={42} />
                    <h2 className="mt-4 text-3xl font-black">{copy.lockedTitle}</h2>
                    <p className="mt-2 text-[#71767B]">{copy.lockedBody}</p>
                    <a className="btn-primary mt-6" href={`/courses/${course.slug}#enroll`}>
                      {copy.enrollNow}
                      <ArrowRight size={17} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {canTrackProgress ? (
              <form className="mt-4 flex justify-end" action="/api/student/bookmark-lesson" method="post">
                <CsrfInput />
                <input type="hidden" name="lessonId" value={selectedLesson.id} />
                <input type="hidden" name="redirect" value={`/learn/${course.slug}?lesson=${selectedLesson.id}`} />
                <button className="btn-secondary w-full sm:w-auto">
                  <Bookmark size={17} />
                  Save lesson bookmark
                </button>
              </form>
            ) : null}

            {quizzes.length > 0 && (
              <div className="moe-panel mt-5 rounded-xl p-5">
                <h3 className="text-lg font-black text-white">{copy.quizzes}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quizzes.map((quiz) => (
                    <a className="btn-secondary" href={`/learn/quiz/${quiz.id}`} key={quiz.id}>
                      {quiz.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 border-t border-violet-300/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
              {previousLesson ? (
                <a className="btn-secondary w-full sm:w-auto" href={lessonHref(previousLesson)}>
                  <ArrowLeft size={17} />
                  {copy.previousLesson}
                </a>
              ) : <span />}
              {nextLesson && (
                <a className="btn-primary w-full sm:w-auto" href={lessonHref(nextLesson)}>
                  {copy.nextLesson}
                  <ArrowRight size={17} />
                </a>
              )}
            </div>

            <div className="moe-panel mt-6 rounded-xl p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-white">
                <MessageCircle size={18} className="text-violet-300" />
                {copy.discussion}
              </h3>
              <p className="mt-2 text-sm text-[#71767B]">{copy.discussionBody}</p>
              <div className="mt-5 grid gap-3">
                {lessonQuestions.length ? lessonQuestions.map((question) => (
                  <article key={question.id} className="rounded-xl border border-violet-300/15 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-black text-white">{question.title}</p>
                      <span className="text-xs font-bold text-slate-500">{question.user.name} / {question.createdAt.toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{question.body}</p>
                    {question.answer ? (
                      <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-100">
                        <b className="block text-emerald-50">Instructor answer</b>
                        {question.answer}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-bold text-[#71767B]">Awaiting instructor answer.</p>
                    )}
                  </article>
                )) : (
                  <p className="rounded-xl border border-violet-300/15 bg-white/[0.03] p-4 text-sm font-semibold text-slate-400">
                    No lesson questions yet. Start the discussion for this lesson.
                  </p>
                )}
              </div>
              {user?.role === 'STUDENT' && isEnrolledStudent && selectedLesson ? (
                <form className="mt-5 grid gap-3 border-t border-violet-300/15 pt-5" action="/api/questions" method="post">
                  <CsrfInput />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="lessonId" value={selectedLesson.id} />
                  <input type="hidden" name="redirect" value={`/learn/${course.slug}?lesson=${selectedLesson.id}`} />
                  <input className="moe-control h-11 w-full px-4 text-sm font-semibold text-white" name="title" placeholder="Question title" required />
                  <textarea className="moe-control min-h-24 w-full px-4 py-3 text-sm font-semibold text-white" name="body" placeholder="Ask about this lesson" required />
                  <button className="btn-primary w-fit">
                    <MessageCircle size={17} />
                    Ask about this lesson
                  </button>
                </form>
              ) : null}
            </div>
          </>
        ) : (
          <div className="moe-panel grid min-h-[60vh] place-items-center rounded-xl p-8 text-center">
            <div>
              <FileText className="mx-auto text-violet-300" size={42} />
              <h2 className="mt-4 text-3xl font-black">{copy.noLessonsTitle}</h2>
              <p className="mt-2 text-[#71767B]">{copy.noLessonsBody}</p>
            </div>
          </div>
        )}
      </section>

      <aside className="moe-sidebar hidden border-l p-5 lg:block">
        <div className="flex gap-5 border-b border-violet-300/15 pb-3 text-sm font-black">
          <span className="border-b-2 border-violet-400 pb-3 text-white">Notes</span>
          <button
            className="pb-3 text-left text-slate-400 hover:text-white"
            type="button"
            data-smart-assistant-trigger
            data-smart-assistant-prompt={`Explain the lesson "${selectedLesson?.title || course.title}" and suggest what I should do next.`}
          >
            AI Assistant
          </button>
          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-200">READY</span>
        </div>
        <div className="mt-5">
          <p className="text-sm font-black text-white">Summary</p>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            {selectedLesson?.content || 'This lesson introduces the core concept and gives learners a practical path to apply it inside the course project.'}
          </p>
        </div>
        {user?.role === 'STUDENT' && isEnrolledStudent ? (
          <div className="mt-6">
            <StudentNotesClient
              csrfToken={csrfToken}
              initialNotes={noteModels}
              courseId={course.id}
              lessonId={selectedLesson?.id || null}
              courseOptions={[{ id: course.id, title: course.title }]}
              lessonOptions={noteLessonOptions}
              compact
            />
          </div>
        ) : null}
        <div className="mt-6 rounded-xl border border-violet-300/15 bg-white/[0.03] p-4">
          <p className="text-sm font-black text-white">Ask the AI assistant</p>
          <p className="mt-3 rounded-xl border border-violet-300/15 bg-[#0a1020] p-4 text-sm leading-6 text-slate-300">
            Open the assistant with this lesson as context, then edit the prompt before sending.
          </p>
          <button
            className="moe-primary mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-black"
            type="button"
            data-smart-assistant-trigger
            data-smart-assistant-prompt={`Explain the lesson "${selectedLesson?.title || course.title}" and suggest what I should do next.`}
          >
            Ask AI
          </button>
          <a className="moe-control mt-3 inline-flex h-10 w-full items-center justify-center text-sm font-black text-white" href={`/courses/${course.slug}#questions`}>
            Ask in course Q&amp;A
          </a>
        </div>
      </aside>
    </main>
  );
}
