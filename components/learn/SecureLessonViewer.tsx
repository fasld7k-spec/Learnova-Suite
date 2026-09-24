'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, ClipboardList, Download, ExternalLink, FileQuestion, FileText, PlayCircle, Radio, ShieldCheck } from 'lucide-react';

type SecureLessonViewerProps = {
  lesson: {
    id?: string;
    type: string;
    title: string;
    videoUrl: string | null;
    content: string | null;
    attachmentUrl: string | null;
  };
  quizzes?: { id: string; title: string }[];
  assignments?: { id: string; title: string; dueAt: string | null }[];
  liveSessions?: { id: string; title: string; startsAt: string; provider: string; url: string }[];
  watermarkLabel?: string | null;
  watermarkLogoUrl?: string | null;
  watermarkEnabled?: boolean;
  csrfToken?: string;
  tracking?: {
    enabled: boolean;
    courseId: string;
    lessonId: string;
    initialWatchSeconds?: number;
    durationSeconds?: number;
  };
};

function lessonActionLabel(type: string) {
  if (type === 'QUIZ') return 'Open quiz';
  if (type === 'ASSIGNMENT') return 'View assignment instructions';
  if (type === 'LIVE') return 'Open live session';
  if (type === 'EXTERNAL') return 'Open external resource';
  if (type === 'FILE') return 'Download file';
  return 'Protected resource';
}

function withPdfViewerHints(url: string) {
  return `${url}${url.includes('#') ? '&' : '#'}toolbar=0&navpanes=0&scrollbar=1`;
}

function formatDateLabel(value: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return date.toLocaleString();
}

function isEmbeddableVideoUrl(url: string | null) {
  if (!url) return false;
  return /iframe\.mediadelivery\.net\/embed\//i.test(url) || /player\.vimeo\.com\/video\//i.test(url) || /youtube(-nocookie)?\.com\/embed\//i.test(url);
}

function SetupNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-[#2F3336] bg-[#101317] p-4 text-sm leading-6 text-[#AAB4BE]">
      <p className="font-black text-white">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}

function WatermarkLogo({ logoUrl, label }: { logoUrl?: string | null; label: string }) {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-10 flex select-none items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 opacity-70 backdrop-blur-sm">
      {logoUrl ? (
        <Image src={logoUrl} alt="" width={24} height={24} className="h-6 w-6 object-contain" draggable={false} unoptimized />
      ) : (
        <ShieldCheck size={18} className="text-white" />
      )}
      <span className="max-w-[150px] truncate text-[10px] font-black uppercase tracking-[0.16em] text-white/80">{label}</span>
    </div>
  );
}

export function SecureLessonViewer({
  lesson,
  quizzes = [],
  assignments = [],
  liveSessions = [],
  watermarkLabel,
  watermarkLogoUrl,
  watermarkEnabled = true,
  csrfToken = '',
  tracking
}: SecureLessonViewerProps) {
  const type = String(lesson.type);
  const externalUrl = lesson.videoUrl || lesson.attachmentUrl;
  const watermarkText = watermarkLabel || 'Protected lesson';
  const initialWatchSeconds = Math.max(0, tracking?.initialWatchSeconds || 0);
  const useEmbedPlayer = type === 'VIDEO' && isEmbeddableVideoUrl(lesson.videoUrl);
  const watchedRef = useRef(initialWatchSeconds);
  const lastSentRef = useRef(initialWatchSeconds);
  const [trackedSeconds, setTrackedSeconds] = useState(initialWatchSeconds);

  const sendWatchProgress = useCallback(async (watchSeconds: number, lastPositionSeconds: number) => {
    if (!tracking?.enabled || !csrfToken || type !== 'VIDEO') return;
    const nextWatchSeconds = Math.max(0, Math.floor(watchSeconds));
    if (nextWatchSeconds <= lastSentRef.current && nextWatchSeconds - lastSentRef.current < 8) return;
    lastSentRef.current = nextWatchSeconds;
    setTrackedSeconds(nextWatchSeconds);
    await fetch('/api/student/lesson-watch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        csrfToken,
        courseId: tracking.courseId,
        lessonId: tracking.lessonId,
        watchSeconds: nextWatchSeconds,
        lastPositionSeconds,
      }),
      keepalive: true,
    }).catch(() => null);
  }, [csrfToken, tracking, type]);

  useEffect(() => {
    const blockSaveShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['s', 'p'].includes(key)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', blockSaveShortcuts);
    return () => window.removeEventListener('keydown', blockSaveShortcuts);
  }, []);

  if (type === 'VIDEO') {
    return (
      <section className="overflow-hidden border border-[#2F3336] bg-black" onContextMenu={(event) => event.preventDefault()}>
        <div className="relative bg-[#050505]">
          {watermarkEnabled && <WatermarkLogo logoUrl={watermarkLogoUrl} label={watermarkText} />}
          {lesson.videoUrl && useEmbedPlayer ? (
            <iframe
              className="aspect-video w-full bg-black"
              src={lesson.videoUrl}
              title={lesson.title}
              loading="lazy"
              allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
              sandbox="allow-same-origin allow-scripts allow-presentation"
            />
          ) : lesson.videoUrl ? (
            <video
              className="aspect-video w-full bg-black object-contain"
              src={lesson.videoUrl}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              disableRemotePlayback
              playsInline
              preload="metadata"
              onContextMenu={(event) => event.preventDefault()}
              onTimeUpdate={(event) => {
                const current = Math.floor(event.currentTarget.currentTime || 0);
                watchedRef.current = Math.max(watchedRef.current, current);
                if (watchedRef.current - lastSentRef.current >= 10) void sendWatchProgress(watchedRef.current, current);
              }}
              onEnded={(event) => {
                const duration = Math.floor(event.currentTarget.duration || tracking?.durationSeconds || watchedRef.current);
                watchedRef.current = Math.max(watchedRef.current, duration);
                void sendWatchProgress(watchedRef.current, duration);
              }}
            />
          ) : (
            <div className="grid aspect-video place-items-center p-8 text-center">
              <div>
                <PlayCircle className="mx-auto text-[#1D9BF0]" size={48} />
                <p className="mt-4 text-lg font-black text-white">{lesson.title}</p>
                <p className="mt-2 text-sm text-[#71767B]">No protected video stream is attached to this lesson yet.</p>
              </div>
            </div>
          )}

          {watermarkEnabled && (
            <div className="pointer-events-none absolute inset-0 select-none opacity-10">
              <div className="grid h-full grid-cols-2 content-around gap-8 p-6 text-[11px] font-black uppercase tracking-[0.18em] text-white sm:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <span className="-rotate-12 justify-self-center" key={index}>{watermarkText}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-[#2F3336] px-5 py-3 text-xs font-bold text-[#71767B]">
          <ShieldCheck size={16} className="text-[#1D9BF0]" />
          Protected streaming is enabled. Download, save, print, remote playback, and right-click actions are restricted in the player.
          {tracking?.enabled && useEmbedPlayer ? <span className="ml-auto text-[#AAB4BE]">Embedded provider playback is not counted automatically.</span> : null}
          {tracking?.enabled && !useEmbedPlayer ? <span className="ml-auto text-[#AAB4BE]">Watch progress: {Math.floor(trackedSeconds / 60)}m {trackedSeconds % 60}s</span> : null}
        </div>
      </section>
    );
  }

  if (type === 'TEXT') {
    return (
      <article className="border border-[#2F3336] bg-black p-6 text-base leading-8 text-[#E7E9EA]" onContextMenu={(event) => event.preventDefault()}>
        {lesson.content || 'No lesson text has been added yet.'}
      </article>
    );
  }

  if (type === 'PDF' && lesson.attachmentUrl) {
    return (
      <section className="relative overflow-hidden border border-[#2F3336] bg-black" onContextMenu={(event) => event.preventDefault()}>
        {watermarkEnabled && <WatermarkLogo logoUrl={watermarkLogoUrl} label={watermarkText} />}
        <iframe
          className="h-[60vh] w-full bg-[#16181C] sm:h-[70vh]"
          src={withPdfViewerHints(lesson.attachmentUrl)}
          title={lesson.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-same-origin allow-scripts"
        />
        <div className="flex items-center gap-2 border-t border-[#2F3336] px-5 py-3 text-xs font-bold text-[#71767B]">
          <ShieldCheck size={16} className="text-[#1D9BF0]" />
          PDF preview is opened inline with toolbar hints and protected media access. Direct download links are not exposed.
        </div>
      </section>
    );
  }

  if (type === 'FILE') {
    return (
      <section className="border border-[#2F3336] bg-black p-6" onContextMenu={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <FileText className="text-[#1D9BF0]" size={32} />
            <h2 className="mt-4 text-2xl font-black text-white">Downloadable lesson file</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              {lesson.content || 'This lesson includes a protected file for enrolled learners.'}
            </p>
          </div>
          {watermarkEnabled && (
            <div className="relative min-h-14 min-w-[180px]">
              <WatermarkLogo logoUrl={watermarkLogoUrl} label={watermarkText} />
            </div>
          )}
        </div>
        {lesson.attachmentUrl ? (
          <div className="mt-6 rounded-lg border border-violet-300/15 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{lesson.title}</p>
                <p className="mt-1 text-xs font-bold text-[#71767B]">Access is checked before the file is served. Shareable source URLs are not exposed.</p>
              </div>
              <a className="btn-primary w-full sm:w-auto" href={lesson.attachmentUrl} target="_blank" rel="noreferrer" download>
                <Download size={17} />
                {lessonActionLabel(type)}
              </a>
            </div>
          </div>
        ) : (
          <SetupNotice title="File attachment needed" body="Upload or attach a file to this lesson before students can download it." />
        )}
        <div className="mt-5 flex items-center gap-2 border-t border-[#2F3336] pt-4 text-xs font-bold text-[#71767B]">
          <ShieldCheck size={16} className="text-[#1D9BF0]" />
          The download button uses the same protected lesson media access flow as video and PDF lessons.
        </div>
      </section>
    );
  }

  if (type === 'LIVE') {
    const primarySession = liveSessions[0];
    return (
      <div className="border border-[#2F3336] bg-black p-6">
        <Radio className="text-[#1D9BF0]" size={32} />
        <h2 className="mt-4 text-2xl font-black text-white">Live lesson</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">{lesson.content || 'Join the scheduled live session from the link below.'}</p>
        {externalUrl || primarySession ? (
          <div className="mt-5 grid gap-3">
            {externalUrl && !liveSessions.length ? (
              <a className="btn-primary w-fit" href={externalUrl} target="_blank" rel="noreferrer">
                {lessonActionLabel(type)}
                <ExternalLink size={17} />
              </a>
            ) : null}
            {liveSessions.map((session) => (
              <form key={session.id} action="/api/student/live-sessions/join" method="post" target="_blank">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <input type="hidden" name="sessionId" value={session.id} />
                <button className="flex w-full items-center justify-between gap-4 rounded-lg border border-[#2F3336] bg-[#101317] p-4 text-left hover:bg-[#16181C]">
                  <span className="min-w-0">
                    <span className="block truncate font-black text-white">{session.title}</span>
                    <span className="mt-1 block text-xs font-semibold text-[#71767B]">
                      {session.provider} / {formatDateLabel(session.startsAt)}
                    </span>
                  </span>
                  <ArrowRight className="shrink-0 text-[#1D9BF0]" size={17} />
                </button>
              </form>
            ))}
          </div>
        ) : (
          <SetupNotice title="No live session is connected yet" body="Add a course live session or attach a meeting URL to this lesson before students can join from here." />
        )}
      </div>
    );
  }

  if (type === 'QUIZ') {
    return (
      <div className="border border-[#2F3336] bg-black p-6">
        <FileQuestion className="text-[#1D9BF0]" size={32} />
        <h2 className="mt-4 text-2xl font-black text-white">Quiz lesson</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">{lesson.content || 'Complete the linked quiz to check your understanding.'}</p>
        {quizzes.length ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {quizzes.map((quiz) => (
              <a className="btn-primary" href={`/learn/quiz/${quiz.id}`} key={quiz.id}>
                {quiz.title}
                <ArrowRight size={17} />
              </a>
            ))}
          </div>
        ) : (
          <SetupNotice title="Quiz setup needed" body="This lesson is marked as a quiz, but no quiz has been linked to it yet." />
        )}
      </div>
    );
  }

  if (type === 'ASSIGNMENT') {
    return (
      <div className="border border-[#2F3336] bg-black p-6">
        <ClipboardList className="text-[#1D9BF0]" size={32} />
        <h2 className="mt-4 text-2xl font-black text-white">Assignment lesson</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">{lesson.content || 'Review the assignment details and submit your work from the student assignments page.'}</p>
        {assignments.length ? (
          <div className="mt-5 grid gap-3">
            {assignments.map((assignment) => (
              <a key={assignment.id} className="flex items-center justify-between gap-4 rounded-lg border border-[#2F3336] bg-[#101317] p-4 text-left hover:bg-[#16181C]" href="/student/assignments">
                <span className="min-w-0">
                  <span className="block truncate font-black text-white">{assignment.title}</span>
                  <span className="mt-1 block text-xs font-semibold text-[#71767B]">Due: {formatDateLabel(assignment.dueAt)}</span>
                </span>
                <ArrowRight className="shrink-0 text-[#1D9BF0]" size={17} />
              </a>
            ))}
          </div>
        ) : (
          <SetupNotice title="Assignment setup needed" body="This lesson is marked as an assignment, but no course assignment has been linked or created yet." />
        )}
      </div>
    );
  }

  if (type === 'EXTERNAL') {
    return (
      <div className="border border-[#2F3336] bg-black p-6">
        <ExternalLink className="text-[#1D9BF0]" size={32} />
        <h2 className="mt-4 text-2xl font-black text-white">External resource</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">{lesson.content || 'Open the external learning resource in a new tab.'}</p>
        {externalUrl ? (
          <a className="btn-primary mt-5" href={externalUrl} target="_blank" rel="noreferrer">
            {lessonActionLabel(type)}
            <ExternalLink size={17} />
          </a>
        ) : (
          <SetupNotice title="External link needed" body="Add a URL to the lesson video or attachment field so students can open the external resource." />
        )}
      </div>
    );
  }

  return (
    <div className="border border-[#2F3336] bg-black p-6" onContextMenu={(event) => event.preventDefault()}>
      <FileText className="text-[#1D9BF0]" size={32} />
      <h2 className="mt-4 text-2xl font-black text-white">{lessonActionLabel(type)}</h2>
      <p className="mt-2 text-sm leading-6 text-[#71767B]">
        {lesson.content || 'This lesson resource is available in view-only protected mode. Direct download links are not exposed from the learning player.'}
      </p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#71767B]">
        <CalendarClock size={16} className="text-[#1D9BF0]" />
        Lesson content is ready for review in the protected player.
      </div>
    </div>
  );
}
