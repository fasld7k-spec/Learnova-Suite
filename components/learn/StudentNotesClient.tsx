'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import { Edit3, Plus, Save, StickyNote, Trash2, X } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

type StudentNote = {
  id: string;
  courseId: string;
  lessonId: string | null;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type SelectOption = {
  id: string;
  title: string;
  courseId?: string;
};

type ApiResult<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export function StudentNotesClient({
  csrfToken,
  initialNotes,
  courseId,
  lessonId,
  courseOptions = [],
  lessonOptions = [],
  allowCourseSelection = false,
  compact = false
}: {
  csrfToken: string;
  initialNotes: StudentNote[];
  courseId?: string;
  lessonId?: string | null;
  courseOptions?: SelectOption[];
  lessonOptions?: SelectOption[];
  allowCourseSelection?: boolean;
  compact?: boolean;
}) {
  const defaultCourseId = courseId || courseOptions[0]?.id || '';
  const [notes, setNotes] = useState(initialNotes);
  const [selectedCourseId, setSelectedCourseId] = useState(defaultCourseId);
  const [selectedLessonId, setSelectedLessonId] = useState(lessonId || '');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleLessons = useMemo(
    () => lessonOptions.filter((option) => !option.courseId || option.courseId === selectedCourseId),
    [lessonOptions, selectedCourseId]
  );
  const lessonTitleById = useMemo(() => new Map(lessonOptions.map((option) => [option.id, option.title])), [lessonOptions]);
  const courseTitleById = useMemo(() => new Map(courseOptions.map((option) => [option.id, option.title])), [courseOptions]);

  async function request<T>(method: string, body: Record<string, unknown>) {
    const response = await fetch('/api/student/notes', {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ ...body, csrfToken })
    });
    const payload = (await response.json().catch(() => ({}))) as ApiResult<T>;
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Unable to save note.');
    return payload.data as T;
  }

  function addNote(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const note = await request<StudentNote>('POST', {
          courseId: selectedCourseId,
          lessonId: selectedLessonId || null,
          content
        });
        setNotes((current) => [note, ...current]);
        setContent('');
      } catch (e: unknown) {
        setError(errorMessage(e, 'Unable to save note.'));
      }
    });
  }

  function saveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        const note = await request<StudentNote>('PATCH', { id, content: editingContent });
        setNotes((current) => current.map((item) => (item.id === id ? note : item)));
        setEditingId(null);
        setEditingContent('');
      } catch (e: unknown) {
        setError(errorMessage(e, 'Unable to update note.'));
      }
    });
  }

  function deleteNote(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await request<{ id: string }>('DELETE', { id });
        setNotes((current) => current.filter((item) => item.id !== id));
      } catch (e: unknown) {
        setError(errorMessage(e, 'Unable to delete note.'));
      }
    });
  }

  return (
    <section className={compact ? '' : 'moe-panel rounded-xl p-5'}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <StickyNote size={17} className="text-violet-300" />
          Notes
        </h3>
        <span className="text-xs font-bold text-slate-500">{notes.length}</span>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={addNote}>
        {allowCourseSelection ? (
          <select className="moe-control h-10 px-3 text-sm font-bold text-white" value={selectedCourseId} onChange={(event) => {
            setSelectedCourseId(event.target.value);
            setSelectedLessonId('');
          }}>
            {courseOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        ) : null}
        {visibleLessons.length ? (
          <select className="moe-control h-10 px-3 text-sm font-bold text-white" value={selectedLessonId} onChange={(event) => setSelectedLessonId(event.target.value)}>
            <option value="">Course note</option>
            {visibleLessons.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        ) : null}
        <textarea
          className="moe-control min-h-28 resize-y p-3 text-sm leading-6 text-white placeholder:text-slate-500"
          placeholder="Write a private note..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
          required
        />
        <button className="moe-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-black" disabled={isPending || !selectedCourseId || !content.trim()}>
          <Plus size={16} />
          Add note
        </button>
      </form>

      {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{error}</p> : null}

      <div className="mt-5 grid gap-3">
        {notes.length ? notes.map((note) => {
          const isEditing = editingId === note.id;
          return (
            <article key={note.id} className="rounded-lg border border-violet-300/15 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-xs font-bold text-slate-500">
                  {courseTitleById.get(note.courseId) || 'Course'}
                  {note.lessonId ? <span> / {lessonTitleById.get(note.lessonId) || 'Lesson'}</span> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isEditing ? (
                    <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10" onClick={() => {
                      setEditingId(null);
                      setEditingContent('');
                    }} aria-label="Cancel edit">
                      <X size={15} />
                    </button>
                  ) : (
                    <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10" onClick={() => {
                      setEditingId(note.id);
                      setEditingContent(note.content);
                    }} aria-label="Edit note">
                      <Edit3 size={15} />
                    </button>
                  )}
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-rose-200 hover:bg-rose-500/10" onClick={() => deleteNote(note.id)} aria-label="Delete note">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {isEditing ? (
                <div className="mt-3 grid gap-3">
                  <textarea className="moe-control min-h-24 resize-y p-3 text-sm leading-6 text-white" value={editingContent} onChange={(event) => setEditingContent(event.target.value)} maxLength={5000} />
                  <button type="button" className="moe-primary inline-flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-black" onClick={() => saveEdit(note.id)} disabled={isPending || !editingContent.trim()}>
                    <Save size={15} />
                    Save
                  </button>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.content}</p>
              )}
            </article>
          );
        }) : (
          <div className="rounded-lg border border-dashed border-violet-300/20 p-4 text-sm leading-6 text-slate-400">
            No notes yet. Add one while you study and it will stay private to your account.
          </div>
        )}
      </div>
    </section>
  );
}
