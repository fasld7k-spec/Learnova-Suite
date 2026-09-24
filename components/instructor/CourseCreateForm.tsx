'use client';

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  DollarSign,
  FileText,
  ImagePlus,
  Layers3,
  ListChecks,
  Loader2,
  MonitorPlay,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud
} from 'lucide-react';
import { localizedDashboardLabel } from '@/lib/localized-copy';

type Category = { id: string; nameEn: string };
type DraftLesson = { id: number; title: string; type: string; isPreview: boolean };
type DraftModule = { id: number; title: string; lessons: DraftLesson[] };
type LessonUploadState = Record<string, { video?: string; attachment?: string }>;

const inputClass = 'input mt-2 bg-[var(--panel-raised)] disabled:cursor-not-allowed disabled:opacity-60';
const labelClass = 'text-sm font-extrabold text-[var(--foreground)]';
const hintClass = 'mt-2 text-xs font-semibold leading-5 text-[var(--muted)]';
const iconWrapClass = 'grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand)]';
const dangerButtonClass =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-bold text-[var(--danger)] transition hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40';
const uploadTileClass =
  'flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-raised)] p-4 transition hover:border-[var(--brand)] hover:bg-[var(--panel-strong)] focus-within:border-[var(--brand)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--brand)]';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function newLesson(id: number): DraftLesson {
  return { id, title: id === 0 ? 'Course introduction' : '', type: 'VIDEO', isPreview: id === 0 };
}

function SectionHeader({
  step,
  title,
  description,
  icon
}: {
  step: string;
  title: string;
  description?: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start">
      <span className={iconWrapClass}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-[var(--brand)]">{step}</p>
        <h2 className="mt-1 text-2xl font-black leading-tight text-[var(--foreground)]">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
    </div>
  );
}

function SubmitButton({ label, pendingLabel, name, value, variant = 'primary' }: { label: string; pendingLabel: string; name?: string; value?: string; variant?: 'primary' | 'secondary' }) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} w-full justify-center sm:w-auto`}
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
    >
      {pending ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : null}
      {pending ? pendingLabel : label}
      {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
    </button>
  );
}

export function CourseCreateForm({ categories, csrfToken, locale, liveLessonsEnabled = true }: { categories: Category[]; csrfToken: string; locale: string; liveLessonsEnabled?: boolean }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState('');
  const [lessonUploads, setLessonUploads] = useState<LessonUploadState>({});
  const [modules, setModules] = useState<DraftModule[]>([
    { id: 0, title: 'Introduction', lessons: [newLesson(0), { id: 1, title: 'Setup and resources', type: 'TEXT', isPreview: false }] }
  ]);
  const t = (label: string) => localizedDashboardLabel(label, locale);

  const derivedSlug = useMemo(() => slug || slugify(title), [slug, title]);
  const lessonCount = modules.reduce((total, module) => total + module.lessons.length, 0);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPreview(null);
      setCoverFileName('');
      return;
    }
    setPreview(URL.createObjectURL(file));
    setCoverFileName(file.name);
  }

  function uploadKey(moduleIndex: number, lessonIndex: number) {
    return `${moduleIndex}-${lessonIndex}`;
  }

  function onLessonFileChange(moduleIndex: number, lessonIndex: number, field: 'video' | 'attachment', event: ChangeEvent<HTMLInputElement>) {
    const fileName = event.target.files?.[0]?.name || '';
    const key = uploadKey(moduleIndex, lessonIndex);
    setLessonUploads((current) => {
      const next = { ...(current[key] || {}), [field]: fileName };
      return { ...current, [key]: next };
    });
  }

  function updateModule(moduleId: number, title: string) {
    setModules((items) => items.map((item) => item.id === moduleId ? { ...item, title } : item));
  }

  function addModule() {
    setModules((items) => {
      const id = Math.max(-1, ...items.map((item) => item.id)) + 1;
      return [...items, { id, title: '', lessons: [newLesson(0)] }];
    });
  }

  function removeModule(moduleId: number) {
    setModules((items) => items.length === 1 ? items : items.filter((item) => item.id !== moduleId));
  }

  function updateLesson(moduleId: number, lessonId: number, patch: Partial<DraftLesson>) {
    setModules((items) =>
      items.map((item) =>
        item.id === moduleId
          ? { ...item, lessons: item.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...patch } : lesson) }
          : item
      )
    );
  }

  function addLesson(moduleId: number) {
    setModules((items) =>
      items.map((item) => {
        if (item.id !== moduleId) return item;
        const id = Math.max(-1, ...item.lessons.map((lesson) => lesson.id)) + 1;
        return { ...item, lessons: [...item.lessons, newLesson(id)] };
      })
    );
  }

  function removeLesson(moduleId: number, lessonId: number) {
    setModules((items) =>
      items.map((item) =>
        item.id === moduleId && item.lessons.length > 1
          ? { ...item, lessons: item.lessons.filter((lesson) => lesson.id !== lessonId) }
          : item
      )
    );
  }

  return (
    <form className="grid gap-6" action="/api/instructor/courses" method="post" encType="multipart/form-data">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="slug" value={derivedSlug} />
      <input type="hidden" name="modulesCount" value={modules.length} />
      {modules.map((module, moduleIndex) => (
        <input key={`count-${module.id}`} type="hidden" name={`lessonsCount-${moduleIndex}`} value={module.lessons.length} />
      ))}

      <section className="ui-panel-muted grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--brand)]">{t('Course draft')}</p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-[var(--foreground)]">{title || t('Untitled course')}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
            {t('Add the buyer-facing details, pricing, outcomes, and first curriculum structure before sending it to review.')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
            <p className="text-lg font-black text-[var(--foreground)]">{modules.length}</p>
            <p className="text-[11px] font-bold uppercase text-[var(--muted)]">{t('Modules')}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
            <p className="text-lg font-black text-[var(--foreground)]">{lessonCount}</p>
            <p className="text-[11px] font-bold uppercase text-[var(--muted)]">{t('Lessons')}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
            <p className="truncate text-lg font-black text-[var(--foreground)]" title={derivedSlug || '-'}>
              {derivedSlug || '-'}
            </p>
            <p className="text-[11px] font-bold uppercase text-[var(--muted)]">{t('Slug')}</p>
          </div>
        </div>
      </section>

      <section className="ui-panel overflow-hidden">
        <SectionHeader
          step={t('Step 1')}
          title={t('Course landing page')}
          description={t('This is the sales page buyers see before enrolling.')}
          icon={<Sparkles size={20} strokeWidth={1.8} aria-hidden="true" />}
        />

        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4">
            <label className="block">
              <span className={labelClass}>{t('Course title')}</span>
              <input
                className={inputClass}
                name="title"
                placeholder={t('Example: Complete Next.js SaaS Bootcamp')}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-describedby="course-title-hint"
              />
              <p id="course-title-hint" className={hintClass}>{t('Use a specific outcome-focused title learners can understand at a glance.')}</p>
            </label>

            <label className="block">
              <span className={labelClass}>{t('Course URL slug')}</span>
              <input
                className={inputClass}
                placeholder="complete-nextjs-saas-bootcamp"
                value={derivedSlug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                aria-describedby="course-slug-hint"
              />
              <p id="course-slug-hint" className={hintClass}>{t('Generated from the title and saved with the hidden slug field on submit.')}</p>
            </label>

            <label className="block">
              <span className={labelClass}>{t('Short description')}</span>
              <textarea
                className={`${inputClass} min-h-24`}
                name="shortDescription"
                placeholder={t('A clear one-paragraph promise for the course.')}
                required
                aria-describedby="course-short-description-hint"
              />
              <p id="course-short-description-hint" className={hintClass}>{t('Lead with the skill, project, or transformation students will get.')}</p>
            </label>

            <label className="block">
              <span className={labelClass}>{t('Full description')}</span>
              <textarea
                className={`${inputClass} min-h-40`}
                name="fullDescription"
                placeholder={t('Describe what students will build, who it is for, and why it matters.')}
                required
                aria-describedby="course-full-description-hint"
              />
              <p id="course-full-description-hint" className={hintClass}>{t('Mention the course format, practical deliverables, and learner prerequisites.')}</p>
            </label>
          </div>

          <aside className="ui-panel-muted overflow-hidden">
            <div className="aspect-video bg-[var(--panel-strong)]">
              {preview ? (
                <img src={preview} alt={t('Course cover preview')} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div>
                    <ImagePlus className="mx-auto text-[var(--brand)]" size={42} strokeWidth={1.7} aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-[var(--foreground)]">{t('Course cover preview')}</p>
                    <p className={hintClass}>{t('16:9 image recommended. JPG, PNG, or WEBP.')}</p>
                  </div>
                </div>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-3 border-t border-[var(--border)] p-4 transition hover:bg-[var(--panel-strong)] focus-within:bg-[var(--panel-strong)]">
              <UploadCloud className="text-[var(--brand)]" size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <span className="block text-sm font-bold text-[var(--foreground)]">{t('Upload cover image')}</span>
                <span className="block text-xs font-semibold text-[var(--muted)]">{coverFileName || t('JPG, PNG, or WEBP. Max 8MB.')}</span>
                </span>
              <input className="sr-only" name="coverImageFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={onImageChange} aria-label={t('Upload course cover image')} />
            </label>
            <label className="block border-t border-[var(--border)] p-4">
              <span className={labelClass}>{t('Or paste image URL')}</span>
              <input className={inputClass} name="coverImage" placeholder="https://..." aria-describedby="course-cover-url-hint" />
              <p id="course-cover-url-hint" className={hintClass}>{t('Use this when the image is already hosted elsewhere.')}</p>
            </label>
          </aside>
        </div>
      </section>

      <section className="ui-panel overflow-hidden">
        <SectionHeader
          step={t('Step 2')}
          title={t('Pricing and basics')}
          description={t('Set catalog metadata and the first public price. You can adjust offers later.')}
          icon={<DollarSign size={20} strokeWidth={1.8} aria-hidden="true" />}
        />
        <div className="grid gap-5 p-5 lg:grid-cols-3">
          <label className="block">
            <span className={labelClass}>{t('Category')}</span>
            <select className={inputClass} name="categoryId" required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameEn}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>{t('Level')}</span>
            <select className={inputClass} name="level" defaultValue="beginner">
              <option value="beginner">{t('Beginner')}</option>
              <option value="intermediate">{t('Intermediate')}</option>
              <option value="advanced">{t('Advanced')}</option>
              <option value="all-levels">{t('All levels')}</option>
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>{t('Language')}</span>
            <select className={inputClass} name="language" defaultValue="en">
              <option value="en">{t('English')}</option>
              <option value="ar">{t('Arabic')}</option>
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>{t('Price')}</span>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-4 top-5 text-[var(--muted)]" size={18} aria-hidden="true" />
              <input className={`${inputClass} pl-11`} name="price" type="number" step="0.01" min="0" inputMode="decimal" placeholder="99" required aria-describedby="course-price-hint" />
            </div>
            <p id="course-price-hint" className={hintClass}>{t('Enter 0 for a free course.')}</p>
          </label>

          <label className="block">
            <span className={labelClass}>{t('Sale price')}</span>
            <input className={inputClass} name="salePrice" type="number" step="0.01" min="0" inputMode="decimal" placeholder="49" aria-describedby="course-sale-price-hint" />
            <p id="course-sale-price-hint" className={hintClass}>{t('Optional discount price shown beside the regular price.')}</p>
          </label>

          <label className="block">
            <span className={labelClass}>{t('Duration')}</span>
            <input className={inputClass} name="durationMinutes" type="number" min="0" inputMode="numeric" placeholder="480" aria-describedby="course-duration-hint" />
            <p id="course-duration-hint" className={hintClass}>{t('Total course length in minutes.')}</p>
          </label>

          <label className="block lg:col-span-3">
            <span className={labelClass}>{t('Promo video URL')}</span>
            <div className="relative">
              <PlayCircle className="pointer-events-none absolute left-4 top-5 text-[var(--muted)]" size={18} aria-hidden="true" />
              <input className={`${inputClass} pl-11`} name="promoVideo" placeholder={t('https://youtube.com/... or hosted video URL')} aria-describedby="course-promo-video-hint" />
            </div>
            <p id="course-promo-video-hint" className={hintClass}>{t('Optional trailer or welcome video for the landing page.')}</p>
          </label>
        </div>
      </section>

      <section className="ui-panel overflow-hidden">
        <SectionHeader
          step={t('Step 3')}
          title={t('Learning outcomes')}
          description={t('Write scannable lines that help reviewers and buyers understand the course promise.')}
          icon={<ListChecks size={20} strokeWidth={1.8} aria-hidden="true" />}
        />

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <CheckCircle2 size={17} className="text-[var(--brand)]" aria-hidden="true" />
              {t('What students will learn')}
            </span>
            <textarea className={`${inputClass} min-h-44`} name="outcomes" placeholder={t('Build a production dashboard\nCreate secure APIs\nIntegrate payments')} />
            <p className={hintClass}>{t('One outcome per line.')}</p>
          </label>

          <label className="block">
            <span className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <ListChecks size={17} className="text-[var(--brand)]" aria-hidden="true" />
              {t('Requirements')}
            </span>
            <textarea className={`${inputClass} min-h-44`} name="requirements" placeholder={t('Basic JavaScript\nReact fundamentals\nNode.js installed')} />
            <p className={hintClass}>{t('One requirement per line.')}</p>
          </label>

          <label className="block lg:col-span-2">
            <span className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <BookOpen size={17} className="text-[var(--brand)]" aria-hidden="true" />
              {t('Who this course is for')}
            </span>
            <textarea className={`${inputClass} min-h-32`} name="targetAudience" placeholder={t('Developers building SaaS products\nDesigners moving into product teams\nFounders launching online businesses')} />
            <p className={hintClass}>{t('One audience segment per line.')}</p>
          </label>

          <label className="ui-panel-muted flex items-start gap-3 p-4 lg:col-span-2">
            <input type="checkbox" name="includesCertificate" defaultChecked className="mt-1 h-5 w-5 accent-[var(--brand)]" aria-describedby="certificate-hint" />
            <span>
              <span className="block text-sm font-bold text-[var(--foreground)]">{t('Include completion certificate')}</span>
              <span id="certificate-hint" className="block text-xs font-semibold leading-5 text-[var(--muted)]">{t('Students can receive a certificate after meeting completion rules.')}</span>
            </span>
          </label>
        </div>
      </section>

      <section className="ui-panel overflow-hidden">
        <SectionHeader
          step={t('Step 4')}
          title={t('Initial curriculum')}
          description={t('Create the first modules and lessons now. You can upload lesson videos, attach PDFs, and mark preview lessons after the course is created too.')}
          icon={<Layers3 size={20} strokeWidth={1.8} aria-hidden="true" />}
        />

        <div className="grid gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="ui-panel-muted p-4">
              <p className="text-xs font-bold uppercase text-[var(--muted)]">{t('Modules')}</p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{modules.length}</p>
            </div>
            <div className="ui-panel-muted p-4">
              <p className="text-xs font-bold uppercase text-[var(--muted)]">{t('Lessons')}</p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{lessonCount}</p>
            </div>
            <div className="ui-panel-muted p-4 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-bold uppercase text-[var(--muted)]">{t('Preview lessons')}</p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                {modules.reduce((total, module) => total + module.lessons.filter((lesson) => lesson.isPreview).length, 0)}
              </p>
            </div>
          </div>

          {modules.map((module, moduleIndex) => (
            <div className="ui-panel-muted overflow-hidden" key={module.id}>
              <div className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className={labelClass}>{t('Module title')}</span>
                  <input
                    className={inputClass}
                    name={`moduleTitle-${moduleIndex}`}
                    placeholder={t('Example: Foundations')}
                    required
                    value={module.title}
                    onChange={(event) => updateModule(module.id, event.target.value)}
                    aria-describedby={`module-${moduleIndex}-hint`}
                  />
                  <p id={`module-${moduleIndex}-hint`} className={hintClass}>{t('Keep module names short and outcome-based.')}</p>
                  <input type="hidden" name={`moduleSortOrder-${moduleIndex}`} value={moduleIndex} />
                </label>
                <div className="md:mt-7">
                  <button
                    className={dangerButtonClass}
                    type="button"
                    disabled={modules.length === 1}
                    onClick={() => removeModule(module.id)}
                    aria-label={t('Remove module')}
                    title={modules.length === 1 ? t('At least one module is required.') : t('Remove module')}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {t('Remove')}
                  </button>
                  {modules.length === 1 ? <p className={hintClass}>{t('At least one module is required.')}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 p-4">
                {module.lessons.map((lesson, lessonIndex) => (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4" key={lesson.id}>
                    {(() => {
                      const fileState = lessonUploads[uploadKey(moduleIndex, lessonIndex)] || {};
                      return (
                        <>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                        {lesson.type === 'VIDEO' ? <MonitorPlay size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase text-[var(--muted)]">{t('Lesson')} {lessonIndex + 1}</p>
                        <p className="truncate text-sm font-black text-[var(--foreground)]">{lesson.title || t('Untitled lesson')}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                      <label className="block">
                        <span className={labelClass}>{t('Lesson title')}</span>
                        <input
                          className={inputClass}
                          name={`lessonTitle-${moduleIndex}-${lessonIndex}`}
                          placeholder={t('Lesson title')}
                          required
                          value={lesson.title}
                          onChange={(event) => updateLesson(module.id, lesson.id, { title: event.target.value })}
                          aria-describedby={`lesson-${moduleIndex}-${lessonIndex}-title-hint`}
                        />
                        <p id={`lesson-${moduleIndex}-${lessonIndex}-title-hint`} className={hintClass}>{t('Use the title students will see in the course player.')}</p>
                      </label>

                      <label className="block">
                        <span className={labelClass}>{t('Type')}</span>
                        <select
                          className={inputClass}
                          name={`lessonType-${moduleIndex}-${lessonIndex}`}
                          value={lesson.type}
                          onChange={(event) => updateLesson(module.id, lesson.id, { type: event.target.value })}
                        >
                          <option value="VIDEO">{t('Video')}</option>
                          <option value="TEXT">{t('Text')}</option>
                          <option value="PDF">{t('PDF')}</option>
                          <option value="FILE">{t('Download')}</option>
                          <option value="QUIZ">{t('Quiz')}</option>
                          <option value="ASSIGNMENT">{t('Assignment')}</option>
                          {liveLessonsEnabled ? <option value="LIVE">{t('Live session')}</option> : null}
                          <option value="EXTERNAL">{t('External link')}</option>
                        </select>
                      </label>

                      <div className="md:mt-7">
                        <button
                          className={dangerButtonClass}
                          type="button"
                          disabled={module.lessons.length === 1}
                          onClick={() => removeLesson(module.id, lesson.id)}
                          aria-label={t('Remove lesson')}
                          title={module.lessons.length === 1 ? t('At least one lesson is required.') : t('Remove lesson')}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          {t('Remove')}
                        </button>
                        {module.lessons.length === 1 ? <p className={hintClass}>{t('At least one lesson is required.')}</p> : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className={labelClass}>{t('Video, live, or external URL')}</span>
                        <input className={inputClass} name={`lessonVideoUrl-${moduleIndex}-${lessonIndex}`} placeholder="https://..." aria-describedby={`lesson-${moduleIndex}-${lessonIndex}-video-url-hint`} />
                        <p id={`lesson-${moduleIndex}-${lessonIndex}-video-url-hint`} className={hintClass}>{t('Use this for hosted video, live session, or external content links.')}</p>
                      </label>
                      <label className="block">
                        <span className={labelClass}>{t('Attachment/PDF URL')}</span>
                        <input className={inputClass} name={`lessonAttachmentUrl-${moduleIndex}-${lessonIndex}`} placeholder="https://..." aria-describedby={`lesson-${moduleIndex}-${lessonIndex}-attachment-url-hint`} />
                        <p id={`lesson-${moduleIndex}-${lessonIndex}-attachment-url-hint`} className={hintClass}>{t('Optional worksheet, PDF, or supporting resource link.')}</p>
                      </label>
                      <label className="block">
                        <span className={labelClass}>{t('Duration in minutes')}</span>
                        <input className={inputClass} name={`lessonDurationMinutes-${moduleIndex}-${lessonIndex}`} type="number" min="0" inputMode="numeric" placeholder="12" aria-describedby={`lesson-${moduleIndex}-${lessonIndex}-duration-hint`} />
                        <p id={`lesson-${moduleIndex}-${lessonIndex}-duration-hint`} className={hintClass}>{t('Approximate viewing or completion time.')}</p>
                      </label>
                      <label className="flex items-start gap-3 pt-7 text-sm font-bold text-[var(--foreground)]">
                        <input
                          className="mt-0.5 h-5 w-5 accent-[var(--brand)]"
                          name={`lessonIsPreview-${moduleIndex}-${lessonIndex}`}
                          type="checkbox"
                          checked={lesson.isPreview}
                          onChange={(event) => updateLesson(module.id, lesson.id, { isPreview: event.target.checked })}
                        />
                        <span>
                          <span className="block">{t('Free preview lesson')}</span>
                          <span className="block text-xs font-semibold leading-5 text-[var(--muted)]">{t('Visible before enrollment.')}</span>
                        </span>
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className={uploadTileClass}>
                        <UploadCloud className="shrink-0 text-[var(--brand)]" size={20} strokeWidth={1.8} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-[var(--foreground)]">{t('Upload lesson video')}</span>
                          <span className="block truncate text-xs font-semibold text-[var(--muted)]">{fileState.video || t('MP4, max 500MB.')}</span>
                        </span>
                        <input
                          className="sr-only"
                          name={`lessonVideoFile-${moduleIndex}-${lessonIndex}`}
                          type="file"
                          accept="video/mp4"
                          aria-label={t('Upload lesson video')}
                          onChange={(event) => onLessonFileChange(moduleIndex, lessonIndex, 'video', event)}
                        />
                      </label>
                      <label className={uploadTileClass}>
                        <UploadCloud className="shrink-0 text-[var(--brand)]" size={20} strokeWidth={1.8} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-[var(--foreground)]">{t('Upload lesson resource')}</span>
                          <span className="block truncate text-xs font-semibold text-[var(--muted)]">{fileState.attachment || t('PDF/image, max 50MB.')}</span>
                        </span>
                        <input
                          className="sr-only"
                          name={`lessonAttachmentFile-${moduleIndex}-${lessonIndex}`}
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/webp"
                          aria-label={t('Upload lesson resource')}
                          onChange={(event) => onLessonFileChange(moduleIndex, lessonIndex, 'attachment', event)}
                        />
                      </label>
                    </div>

                    <textarea
                      className={`${inputClass} mt-4 min-h-24`}
                      name={`lessonContent-${moduleIndex}-${lessonIndex}`}
                      placeholder={t('Text lesson body, assignment instructions, quiz notes, or resource description')}
                      aria-label={t('Lesson content')}
                    />
                    {lesson.type === 'QUIZ' ? (
                      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                        <p className="text-sm font-black text-[var(--foreground)]">{t('Quiz details')}</p>
                        <p className={hintClass}>{t('Add the first real quiz question now. More questions can be managed after the course is saved.')}</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input className={inputClass} name={`quizTitle-${moduleIndex}-${lessonIndex}`} placeholder={t('Quiz title')} />
                          <input className={inputClass} name={`quizPassingScore-${moduleIndex}-${lessonIndex}`} type="number" min="1" max="100" placeholder={t('Passing score')} />
                        </div>
                        <textarea className={`${inputClass} mt-3 min-h-20`} name={`quizQuestionPrompt-${moduleIndex}-${lessonIndex}`} placeholder={t('Question prompt')} required />
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input className={inputClass} name={`quizOptionA-${moduleIndex}-${lessonIndex}`} placeholder={t('Answer option A')} required />
                          <input className={inputClass} name={`quizOptionB-${moduleIndex}-${lessonIndex}`} placeholder={t('Answer option B')} required />
                          <input className={inputClass} name={`quizOptionC-${moduleIndex}-${lessonIndex}`} placeholder={t('Answer option C')} />
                          <input className={inputClass} name={`quizOptionD-${moduleIndex}-${lessonIndex}`} placeholder={t('Answer option D')} />
                          <input className={`${inputClass} md:col-span-2`} name={`quizAnswer-${moduleIndex}-${lessonIndex}`} placeholder={t('Correct answer exactly as written in the options')} required />
                        </div>
                      </div>
                    ) : null}
                    {lesson.type === 'ASSIGNMENT' ? (
                      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                        <p className="text-sm font-black text-[var(--foreground)]">{t('Assignment details')}</p>
                        <p className={hintClass}>{t('Give students clear instructions and an optional deadline.')}</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input className={inputClass} name={`assignmentTitle-${moduleIndex}-${lessonIndex}`} placeholder={t('Assignment title')} />
                          <input className={inputClass} name={`assignmentDueAt-${moduleIndex}-${lessonIndex}`} type="datetime-local" />
                        </div>
                        <textarea className={`${inputClass} mt-3 min-h-24`} name={`assignmentDescription-${moduleIndex}-${lessonIndex}`} placeholder={t('Submission instructions')} required />
                      </div>
                    ) : null}
                    {lesson.type === 'LIVE' ? (
                      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                        <p className="text-sm font-black text-[var(--foreground)]">{t('Live session details')}</p>
                        <p className={hintClass}>{t('Schedule the session and paste the meeting URL students will use.')}</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input className={inputClass} name={`liveTitle-${moduleIndex}-${lessonIndex}`} placeholder={t('Live session title')} />
                          <input className={inputClass} name={`liveStartsAt-${moduleIndex}-${lessonIndex}`} type="datetime-local" required />
                          <input className={inputClass} name={`liveDurationMinutes-${moduleIndex}-${lessonIndex}`} type="number" min="1" placeholder={t('Duration in minutes')} />
                          <select className={inputClass} name={`liveProvider-${moduleIndex}-${lessonIndex}`} defaultValue="EXTERNAL">
                            <option value="EXTERNAL">{t('External meeting link')}</option>
                            <option value="ZOOM">{t('Zoom')}</option>
                            <option value="GOOGLE_MEET">{t('Google Meet')}</option>
                            <option value="TEAMS">{t('Microsoft Teams')}</option>
                          </select>
                          <input className={`${inputClass} md:col-span-2`} name={`liveUrl-${moduleIndex}-${lessonIndex}`} placeholder={t('Meeting URL')} required />
                        </div>
                        <textarea className={`${inputClass} mt-3 min-h-20`} name={`liveDescription-${moduleIndex}-${lessonIndex}`} placeholder={t('Live session agenda')} />
                        <label className="mt-3 flex items-start gap-3 text-sm font-bold text-[var(--foreground)]">
                          <input className="mt-0.5 h-5 w-5 accent-[var(--brand)]" name={`liveIsPreview-${moduleIndex}-${lessonIndex}`} type="checkbox" />
                          <span>
                            <span className="block">{t('Allow free live preview')}</span>
                            <span className="block text-xs font-semibold leading-5 text-[var(--muted)]">{t('Visitors can see this live session before enrollment if the lesson is also marked as preview.')}</span>
                          </span>
                        </label>
                      </div>
                    ) : null}
                    <input type="hidden" name={`lessonSortOrder-${moduleIndex}-${lessonIndex}`} value={lessonIndex} />
                        </>
                      );
                    })()}
                  </div>
                ))}

                <button className="btn-secondary w-fit" type="button" onClick={() => addLesson(module.id)}>
                  <Plus size={17} aria-hidden="true" />
                  {t('Add lesson')}
                </button>
              </div>
            </div>
          ))}

          <button className="btn-secondary w-fit" type="button" onClick={addModule}>
            <Plus size={17} aria-hidden="true" />
            {t('Add module')}
          </button>
        </div>
      </section>

      <section className="ui-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--brand)]">
            <Layers3 size={17} aria-hidden="true" />
            {t('Save draft or submit for admin review')}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{t('Save a private draft while building, or submit it when the landing page and first lessons are ready.')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton label={t('Save draft')} pendingLabel={t('Saving draft')} name="status" value="DRAFT" variant="secondary" />
          <SubmitButton label={t('Submit for review')} pendingLabel={t('Submitting course')} name="status" value="PENDING" />
        </div>
      </section>
    </form>
  );
}
