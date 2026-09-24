import { notFound } from 'next/navigation';
import { FileText, Link2, MonitorPlay, Pencil, Plus, Radio, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { CsrfInput } from '@/components/CsrfInput';
import { FileUploadLabel } from '@/components/instructor/FileUploadLabel';
import { fromJsonArray } from '@/lib/json-fields';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getSiteSettings } from '@/lib/site-settings';
import { getAddonRuntime } from '@/lib/addons';

const lessonTypes = [
  ['VIDEO', 'Video'],
  ['TEXT', 'Text'],
  ['PDF', 'PDF'],
  ['FILE', 'Download'],
  ['QUIZ', 'Quiz'],
  ['ASSIGNMENT', 'Assignment'],
  ['LIVE', 'Live session'],
  ['EXTERNAL', 'External link']
] as const;

function typeIcon(type: string) {
  if (type === 'VIDEO') return <MonitorPlay size={16} className="text-[#1D9BF0]" />;
  if (type === 'TEXT') return <FileText size={16} className="text-[#1D9BF0]" />;
  if (type === 'LIVE') return <Radio size={16} className="text-[#1D9BF0]" />;
  return <Link2 size={16} className="text-[#1D9BF0]" />;
}

function toDateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default async function CourseBuilder(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const user = await requireUser(['INSTRUCTOR']);
  const [course, settings, categories, liveAddon] = await Promise.all([
    prisma.course.findFirst({
      where: { id: params.id, instructorId: user.id },
      include: {
        modules: {
          include: { lessons: { include: { videoAsset: true }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] } },
          orderBy: { sortOrder: 'asc' }
        }
      }
    }),
    getSiteSettings(),
    prisma.category.findMany({ orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true } }),
    getAddonRuntime('live-class-booking')
  ]);

  if (!course) notFound();
  const lessonIds = course.modules.flatMap((courseModule) => courseModule.lessons.map((lesson) => lesson.id));
  const [quizzes, assignments, liveSessions] = lessonIds.length
    ? await Promise.all([
        prisma.quiz.findMany({ where: { lessonId: { in: lessonIds } } }),
        prisma.assignment.findMany({ where: { lessonId: { in: lessonIds } } }),
        prisma.liveSession.findMany({ where: { lessonId: { in: lessonIds } } })
      ])
    : [[], [], []] as const;
  const quizByLesson = new Map(quizzes.map((quiz) => [quiz.lessonId, quiz]));
  const assignmentByLesson = new Map(assignments.filter((assignment) => assignment.lessonId).map((assignment) => [assignment.lessonId!, assignment]));
  const liveByLesson = new Map(liveSessions.filter((session) => session.lessonId).map((session) => [session.lessonId!, session]));
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);
  const requirements = fromJsonArray<string>(course.requirements).join('\n');
  const outcomes = fromJsonArray<string>(course.outcomes).join('\n');
  const targetAudience = fromJsonArray<string>(course.targetAudience).join('\n');
  const availableLessonTypes = liveAddon.active ? lessonTypes : lessonTypes.filter(([value]) => value !== 'LIVE');

  return (
    <DashboardShell role="instructor" title={`Course Builder: ${course.title}`}>
      {searchParams?.error ? (
        <div className="mb-6 border border-[#FFD400] bg-black p-4 text-sm font-bold text-[#FFD400]">
          {searchParams.error}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="grid gap-5">
          {course.modules.length === 0 && (
            <div className="border border-[#2F3336] bg-black p-6">
              <p className="text-sm font-bold text-[#1D9BF0]">{t('Curriculum is empty')}</p>
              <h2 className="mt-2 text-2xl font-black text-white">{t('Start by creating the first module')}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
                {t('After creating a module, you can add lessons with uploaded MP4 videos, PDFs, downloadable files, text lessons, quizzes, assignments, live sessions, and external links.')}
              </p>
            </div>
          )}

          {course.modules.map((module, moduleIndex) => (
            <div className="border border-[#2F3336] bg-black" key={module.id}>
              <div className="flex items-center justify-between gap-4 border-b border-[#2F3336] p-5">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71767B]">{t('Module')} {moduleIndex + 1}</p>
                  <h2 className="mt-1 truncate text-xl font-black text-white">{module.title}</h2>
                </div>
                <span className="rounded-full border border-[#2F3336] px-3 py-1 text-xs font-bold text-[#71767B]">
                  {module.lessons.length} {t('lessons')}
                </span>
              </div>
              <details className="border-b border-[#2F3336] p-5">
                <summary className="cursor-pointer text-sm font-bold text-[#1D9BF0]">{t('Edit module settings')}</summary>
                <div className="mt-4 grid gap-3">
                  <form className="grid gap-3 md:grid-cols-[1fr_120px_auto]" action="/api/instructor/modules" method="post">
                    <CsrfInput />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleId" value={module.id} />
                    <input className="input" name="title" defaultValue={module.title} required />
                    <input className="input" name="sortOrder" type="number" min="0" defaultValue={module.sortOrder} />
                    <button className="btn-primary justify-center">
                      <Pencil size={16} />
                      {t('Save module')}
                    </button>
                  </form>
                  <form action="/api/instructor/modules" method="post">
                    <CsrfInput />
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleId" value={module.id} />
                    <button className="inline-flex items-center gap-2 rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">
                      <Trash2 size={16} />
                      {t('Delete module and lessons')}
                    </button>
                  </form>
                </div>
              </details>

              <div className="divide-y divide-[#2F3336]">
                {module.lessons.map((lesson, lessonIndex) => {
                  const quiz = quizByLesson.get(lesson.id);
                  const quizQuestion = fromJsonArray<{ q?: string; options?: string[]; answer?: string }>(quiz?.questions)[0] || {};
                  const quizOptions = quizQuestion.options || [];
                  const assignment = assignmentByLesson.get(lesson.id);
                  const liveSession = liveByLesson.get(lesson.id);

                  return (
                  <div key={lesson.id}>
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#2F3336] text-xs font-black text-[#71767B]" title={t('Use sort order to reorder lessons')}>
                          {lesson.sortOrder || lessonIndex + 1}
                        </span>
                        {typeIcon(String(lesson.type))}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{lesson.title}</p>
                          <p className="mt-1 text-xs text-[#71767B]">
                            {t('Lesson')} {lessonIndex + 1} / {lesson.type} / {lesson.durationMinutes || 0} min
                            {lesson.isPreview ? ` / ${t('Free preview')}` : ''}
                            {lesson.videoAsset ? ` / ${t('Video')} ${lesson.videoAsset.status}` : lesson.videoUrl ? ` / ${t('Video ready')}` : ''}
                            {lesson.attachmentUrl ? ` / ${t('Attachment ready')}` : ''}
                          </p>
                        </div>
                      </div>
                      <form action="/api/instructor/lessons" method="post" className="flex items-center gap-3 sm:shrink-0">
                        <CsrfInput />
                        <input type="hidden" name="action" value="toggle-preview" />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <label className="inline-flex h-9 items-center gap-2 rounded-full border border-[#2F3336] px-3 text-xs font-bold text-[#E7E9EA] transition hover:bg-[#16181C]">
                          <input type="checkbox" name="isPreview" defaultChecked={lesson.isPreview} className="h-4 w-4 accent-[#1D9BF0]" />
                          {t('Free preview')}
                        </label>
                        <button className="inline-flex h-9 items-center rounded-full bg-[#1D9BF0] px-4 text-xs font-bold text-white transition hover:bg-[#1A8CD8]">
                          {t('Save')}
                        </button>
                      </form>
                    </div>
                    <details className="px-4 pb-4">
                      <summary className="cursor-pointer text-xs font-bold text-[#1D9BF0]">{t('Edit lesson content and files')}</summary>
                      <form className="mt-4 grid gap-4 border border-[#2F3336] p-4" action="/api/instructor/lessons" method="post" encType="multipart/form-data">
                        <CsrfInput />
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="moduleId" value={module.id} />
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <div className="grid gap-3 md:grid-cols-2">
                          <input className="input" name="title" defaultValue={lesson.title} required />
                          <select className="input" name="type" defaultValue={String(lesson.type)}>
                            {availableLessonTypes.map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <input className="input" name="videoUrl" defaultValue={lesson.videoUrl || ''} placeholder={t('Video, live, or external URL')} />
                          <input className="input" name="attachmentUrl" defaultValue={lesson.attachmentUrl || ''} placeholder={t('Attachment/PDF URL')} />
                          <input className="input" name="durationMinutes" type="number" min="0" defaultValue={lesson.durationMinutes || 0} />
                          <input className="input" name="sortOrder" type="number" min="0" defaultValue={lesson.sortOrder || 0} />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <FileUploadLabel name="videoFile" accept="video/mp4" title={t('Replace/upload lesson video')} hint={t('MP4, max 500MB.')} />
                          <FileUploadLabel name="attachmentFile" accept="application/pdf,image/png,image/jpeg,image/webp" title={t('Replace/upload attachment')} hint={t('PDF/image, max 50MB.')} />
                        </div>
                        <textarea className="input min-h-28" name="content" defaultValue={lesson.content || ''} />
                        <details className="border border-[#2F3336] bg-[#050608] p-4" open={lesson.type === 'QUIZ'}>
                          <summary className="cursor-pointer text-sm font-black text-white">{t('Quiz details')}</summary>
                          <p className="mt-2 text-xs leading-5 text-[#71767B]">{t('Required when this lesson type is Quiz. The first question is saved directly with the lesson.')}</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input className="input" name="quizTitle" defaultValue={quiz?.title || ''} placeholder={t('Quiz title')} />
                            <input className="input" name="passingScore" type="number" min="1" max="100" defaultValue={quiz?.passingScore || 70} placeholder={t('Passing score')} />
                          </div>
                          <textarea className="input mt-3 min-h-20" name="questionPrompt" defaultValue={quizQuestion.q || ''} placeholder={t('Question prompt')} />
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input className="input" name="optionA" defaultValue={quizOptions[0] || ''} placeholder={t('Answer option A')} />
                            <input className="input" name="optionB" defaultValue={quizOptions[1] || ''} placeholder={t('Answer option B')} />
                            <input className="input" name="optionC" defaultValue={quizOptions[2] || ''} placeholder={t('Answer option C')} />
                            <input className="input" name="optionD" defaultValue={quizOptions[3] || ''} placeholder={t('Answer option D')} />
                            <input className="input md:col-span-2" name="answer" defaultValue={quizQuestion.answer || ''} placeholder={t('Correct answer exactly as written in the options')} />
                          </div>
                        </details>
                        <details className="border border-[#2F3336] bg-[#050608] p-4" open={lesson.type === 'ASSIGNMENT'}>
                          <summary className="cursor-pointer text-sm font-black text-white">{t('Assignment details')}</summary>
                          <p className="mt-2 text-xs leading-5 text-[#71767B]">{t('Required when this lesson type is Assignment. Students submit files or text against these instructions.')}</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input className="input" name="assignmentTitle" defaultValue={assignment?.title || ''} placeholder={t('Assignment title')} />
                            <input className="input" name="assignmentDueAt" type="datetime-local" defaultValue={toDateTimeLocal(assignment?.dueAt)} />
                          </div>
                          <textarea className="input mt-3 min-h-24" name="assignmentDescription" defaultValue={assignment?.description || ''} placeholder={t('Submission instructions')} />
                        </details>
                        <details className="border border-[#2F3336] bg-[#050608] p-4" open={lesson.type === 'LIVE'}>
                          <summary className="cursor-pointer text-sm font-black text-white">{t('Live session details')}</summary>
                          <p className="mt-2 text-xs leading-5 text-[#71767B]">{t('Required when this lesson type is Live session. The public instructor profile uses the same scheduled session data.')}</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input className="input" name="liveTitle" defaultValue={liveSession?.title || ''} placeholder={t('Live session title')} />
                            <input className="input" name="liveStartsAt" type="datetime-local" defaultValue={toDateTimeLocal(liveSession?.startsAt)} />
                            <input className="input" name="liveDurationMinutes" type="number" min="1" defaultValue={liveSession?.durationMinutes || lesson.durationMinutes || 60} placeholder={t('Duration in minutes')} />
                            <select className="input" name="liveProvider" defaultValue={liveSession?.provider || 'EXTERNAL'}>
                              <option value="EXTERNAL">{t('External meeting link')}</option>
                              <option value="ZOOM">{t('Zoom')}</option>
                              <option value="GOOGLE_MEET">{t('Google Meet')}</option>
                              <option value="TEAMS">{t('Microsoft Teams')}</option>
                            </select>
                            <input className="input md:col-span-2" name="liveUrl" defaultValue={liveSession?.url || lesson.videoUrl || ''} placeholder={t('Meeting URL')} />
                          </div>
                          <textarea className="input mt-3 min-h-20" name="liveDescription" defaultValue={liveSession?.description || ''} placeholder={t('Live session agenda')} />
                          <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-[#E7E9EA]">
                            <input type="checkbox" name="liveIsPreview" defaultChecked={liveSession?.isPreview || false} className="h-4 w-4 accent-[#1D9BF0]" />
                            {t('Allow free live preview')}
                          </label>
                        </details>
                        <label className="flex items-center gap-3 text-sm font-semibold text-[#E7E9EA]">
                          <input type="checkbox" name="isPreview" defaultChecked={lesson.isPreview} className="h-4 w-4 accent-[#1D9BF0]" />
                          {t('Free preview lesson')}
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <button className="btn-primary">
                            <Pencil size={17} />
                            {t('Save lesson')}
                          </button>
                        </div>
                      </form>
                      <form className="mt-3 grid gap-3 rounded-lg border border-[#2F3336] bg-[#050608] p-4" action="/api/instructor/videos/upload" method="post" encType="multipart/form-data">
                        <CsrfInput />
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <input type="hidden" name="redirect" value={`/instructor/courses/${course.id}?videoUploaded=1`} />
                        <p className="text-sm font-black text-white">{t('Upload to Bunny video processing')}</p>
                        <p className="text-xs leading-5 text-[#71767B]">
                          {t('Use this when Bunny Stream is configured. The processed video asset is linked to this lesson automatically.')}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <FileUploadLabel name="file" accept="video/mp4,video/webm,video/quicktime" title={t('Upload processed video')} hint={t('MP4/WebM/MOV, max 500MB.')} />
                          <button className="btn-secondary h-fit sm:mt-1">
                            <UploadCloud size={17} />
                            {t('Process video')}
                          </button>
                        </div>
                      </form>
                      <form className="mt-3" action="/api/instructor/lessons" method="post">
                        <CsrfInput />
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="lessonId" value={lesson.id} />
                        <button className="inline-flex items-center gap-2 rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">
                          <Trash2 size={16} />
                          {t('Delete lesson')}
                        </button>
                      </form>
                    </details>
                  </div>
                  );
                })}
              </div>

              <form className="grid gap-4 border-t border-[#2F3336] p-5" action="/api/instructor/lessons" method="post" encType="multipart/form-data">
                <CsrfInput />
                <input type="hidden" name="moduleId" value={module.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <div>
                  <p className="text-sm font-black text-white">{t('Add lesson to this module')}</p>
                  <p className="mt-1 text-xs leading-5 text-[#71767B]">{t('Upload the lesson video or paste an external protected video URL. Attach PDFs/resources for students when needed.')}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input" name="title" placeholder={t('Lesson title')} required />
                  <select className="input" name="type" defaultValue="VIDEO">
                    {availableLessonTypes.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input className="input" name="videoUrl" placeholder={t('Video, live, or external URL')} />
                  <input className="input" name="attachmentUrl" placeholder={t('Attachment/PDF URL')} />
                  <input className="input" name="durationMinutes" type="number" min="0" placeholder={t('Duration in minutes')} />
                  <input className="input" name="sortOrder" type="number" min="0" placeholder={t('Sort order')} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FileUploadLabel name="videoFile" accept="video/mp4" title={t('Upload lesson video')} hint={t('MP4, max 500MB. Stored in configured storage.')} />
                  <FileUploadLabel name="attachmentFile" accept="application/pdf,image/png,image/jpeg,image/webp" title={t('Upload lesson resource')} hint={t('PDF/image attachment, max 50MB.')} />
                </div>
                <textarea className="input min-h-28" name="content" placeholder={t('Text lesson body, assignment instructions, or quiz notes')} />
                <details className="border border-[#2F3336] bg-[#050608] p-4">
                  <summary className="cursor-pointer text-sm font-black text-white">{t('Quiz details')}</summary>
                  <p className="mt-2 text-xs leading-5 text-[#71767B]">{t('Fill this section when the new lesson type is Quiz.')}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input className="input" name="quizTitle" placeholder={t('Quiz title')} />
                    <input className="input" name="passingScore" type="number" min="1" max="100" placeholder={t('Passing score')} />
                  </div>
                  <textarea className="input mt-3 min-h-20" name="questionPrompt" placeholder={t('Question prompt')} />
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input className="input" name="optionA" placeholder={t('Answer option A')} />
                    <input className="input" name="optionB" placeholder={t('Answer option B')} />
                    <input className="input" name="optionC" placeholder={t('Answer option C')} />
                    <input className="input" name="optionD" placeholder={t('Answer option D')} />
                    <input className="input md:col-span-2" name="answer" placeholder={t('Correct answer exactly as written in the options')} />
                  </div>
                </details>
                <details className="border border-[#2F3336] bg-[#050608] p-4">
                  <summary className="cursor-pointer text-sm font-black text-white">{t('Assignment details')}</summary>
                  <p className="mt-2 text-xs leading-5 text-[#71767B]">{t('Fill this section when the new lesson type is Assignment.')}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input className="input" name="assignmentTitle" placeholder={t('Assignment title')} />
                    <input className="input" name="assignmentDueAt" type="datetime-local" />
                  </div>
                  <textarea className="input mt-3 min-h-24" name="assignmentDescription" placeholder={t('Submission instructions')} />
                </details>
                <details className="border border-[#2F3336] bg-[#050608] p-4">
                  <summary className="cursor-pointer text-sm font-black text-white">{t('Live session details')}</summary>
                  <p className="mt-2 text-xs leading-5 text-[#71767B]">{t('Fill this section when the new lesson type is Live session.')}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input className="input" name="liveTitle" placeholder={t('Live session title')} />
                    <input className="input" name="liveStartsAt" type="datetime-local" />
                    <input className="input" name="liveDurationMinutes" type="number" min="1" placeholder={t('Duration in minutes')} />
                    <select className="input" name="liveProvider" defaultValue="EXTERNAL">
                      <option value="EXTERNAL">{t('External meeting link')}</option>
                      <option value="ZOOM">{t('Zoom')}</option>
                      <option value="GOOGLE_MEET">{t('Google Meet')}</option>
                      <option value="TEAMS">{t('Microsoft Teams')}</option>
                    </select>
                    <input className="input md:col-span-2" name="liveUrl" placeholder={t('Meeting URL')} />
                  </div>
                  <textarea className="input mt-3 min-h-20" name="liveDescription" placeholder={t('Live session agenda')} />
                  <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-[#E7E9EA]">
                    <input type="checkbox" name="liveIsPreview" className="h-4 w-4 accent-[#1D9BF0]" />
                    {t('Allow free live preview')}
                  </label>
                </details>
                <label className="flex items-center gap-3 text-sm font-semibold text-[#E7E9EA]">
                  <input type="checkbox" name="isPreview" className="h-4 w-4 accent-[#1D9BF0]" />
                  {t('Free preview lesson')}
                </label>
                <button className="btn-primary w-fit">
                  <Plus size={17} />
                  {t('Add lesson')}
                </button>
              </form>
            </div>
          ))}
        </section>

        <aside className="h-fit border border-[#2F3336] bg-black p-5">
          <details className="mb-5 border-b border-[#2F3336] pb-5" open={course.status !== 'PUBLISHED'}>
            <summary className="cursor-pointer text-lg font-black text-white">{t('Course details and review status')}</summary>
            <div className="mt-4 grid gap-4">
              <div className="rounded-lg border border-[#2F3336] bg-[#050608] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#71767B]">{t('Current status')}</p>
                <p className="mt-2 text-xl font-black text-white">{course.status}</p>
                <p className="mt-2 text-xs leading-5 text-[#71767B]">{t('Drafts stay private. Pending courses wait for admin approval. Published courses are live in the marketplace.')}</p>
              </div>
              <form className="grid gap-3" action="/api/instructor/courses" method="post" encType="multipart/form-data">
                <CsrfInput />
                <input type="hidden" name="action" value="update" />
                <input type="hidden" name="courseId" value={course.id} />
                <input className="input" name="title" defaultValue={course.title} required />
                <textarea className="input min-h-24" name="shortDescription" defaultValue={course.shortDescription} required />
                <textarea className="input min-h-32" name="fullDescription" defaultValue={course.fullDescription} required />
                <select className="input" name="categoryId" defaultValue={course.categoryId}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.nameEn}</option>)}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input" name="price" type="number" min="0" step="0.01" defaultValue={String(course.price)} />
                  <input className="input" name="salePrice" type="number" min="0" step="0.01" defaultValue={course.salePrice ? String(course.salePrice) : ''} placeholder={t('Sale price')} />
                  <select className="input" name="level" defaultValue={course.level}>
                    <option value="beginner">{t('Beginner')}</option>
                    <option value="intermediate">{t('Intermediate')}</option>
                    <option value="advanced">{t('Advanced')}</option>
                    <option value="all-levels">{t('All levels')}</option>
                  </select>
                  <select className="input" name="language" defaultValue={course.language}>
                    <option value="en">{t('English')}</option>
                    <option value="ar">{t('Arabic')}</option>
                  </select>
                  <input className="input" name="durationMinutes" type="number" min="0" defaultValue={course.durationMinutes} />
                  <input className="input" name="promoVideo" defaultValue={course.promoVideo || ''} placeholder={t('Promo video URL')} />
                </div>
                <input className="input" name="coverImage" defaultValue={course.coverImage || ''} placeholder={t('Cover image URL')} />
                <FileUploadLabel name="coverImageFile" accept="image/png,image/jpeg,image/webp" title={t('Replace course cover')} hint={t('JPG, PNG, WEBP. Max 8MB.')} />
                <textarea className="input min-h-24" name="outcomes" defaultValue={outcomes} placeholder={t('What students will learn')} />
                <textarea className="input min-h-24" name="requirements" defaultValue={requirements} placeholder={t('Requirements')} />
                <textarea className="input min-h-24" name="targetAudience" defaultValue={targetAudience} placeholder={t('Who this course is for')} />
                <label className="flex items-center gap-3 text-sm font-semibold text-[#E7E9EA]">
                  <input type="checkbox" name="includesCertificate" defaultChecked={course.includesCertificate} className="h-4 w-4 accent-[#1D9BF0]" />
                  {t('Include completion certificate')}
                </label>
                <button className="btn-primary justify-center">{t('Save course details')}</button>
              </form>
              <div className="flex flex-wrap gap-2">
                {course.status !== 'PUBLISHED' && (
                  <form action="/api/instructor/courses" method="post">
                    <CsrfInput />
                    <input type="hidden" name="action" value="submit-review" />
                    <input type="hidden" name="courseId" value={course.id} />
                    <button className="btn-primary">{t('Submit for review')}</button>
                  </form>
                )}
                {course.status !== 'DRAFT' && course.status !== 'PUBLISHED' && (
                  <form action="/api/instructor/courses" method="post">
                    <CsrfInput />
                    <input type="hidden" name="action" value="move-draft" />
                    <input type="hidden" name="courseId" value={course.id} />
                    <button className="btn-secondary">{t('Move back to draft')}</button>
                  </form>
                )}
              </div>
            </div>
          </details>
          <div className="flex items-start gap-3">
            <ShieldCheck size={19} className="mt-1 text-[#1D9BF0]" />
            <div>
              <h2 className="text-xl font-black text-white">{t('Add module')}</h2>
              <p className="mt-1 text-sm leading-6 text-[#71767B]">{t('Build a Udemy-style curriculum with ordered modules, previews, resources, quizzes, assignments, and live lessons.')}</p>
            </div>
          </div>
          <form className="mt-5 grid gap-3" action="/api/instructor/modules" method="post">
            <CsrfInput />
            <input type="hidden" name="courseId" value={course.id} />
            <input className="input" name="title" placeholder={t('Module title')} required />
            <input className="input" name="sortOrder" type="number" min="0" placeholder={t('Sort order')} />
            <button className="btn-primary justify-center">
              <Plus size={17} />
              {t('Create module')}
            </button>
          </form>
        </aside>
      </div>
    </DashboardShell>
  );
}
