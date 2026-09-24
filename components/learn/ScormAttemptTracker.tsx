'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

type ScormStatus = 'IN_PROGRESS' | 'COMPLETED' | 'PASSED' | 'FAILED';

function normalizeStatus(value: unknown): ScormStatus | null {
  const status = String(value || '').toLowerCase();
  if (['completed', 'complete'].includes(status)) return 'COMPLETED';
  if (status === 'passed') return 'PASSED';
  if (status === 'failed') return 'FAILED';
  if (['in_progress', 'incomplete', 'running'].includes(status)) return 'IN_PROGRESS';
  return null;
}

function readRuntimeMessage(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const runtime = data as Record<string, unknown>;
  const rawStatus = runtime.status || runtime.lesson_status || runtime.completion_status || runtime['cmi.core.lesson_status'] || runtime['cmi.completion_status'];
  const scoreValue = runtime.score || runtime.rawScore || runtime['cmi.core.score.raw'] || runtime['cmi.score.raw'];
  const status = normalizeStatus(rawStatus);
  const score = scoreValue === undefined || scoreValue === null || scoreValue === '' ? null : Number(scoreValue);
  return { status, score: Number.isFinite(score) ? Math.round(score as number) : null, runtimeData: runtime };
}

export function ScormAttemptTracker({ packageId, csrfToken }: { packageId: string; csrfToken: string }) {
  const [status, setStatus] = useState<ScormStatus>('IN_PROGRESS');
  const [saved, setSaved] = useState(false);
  const completedRef = useRef(false);

  const record = useCallback(async (nextStatus: ScormStatus, runtimeData: Record<string, unknown> = {}, score: number | null = null, keepalive = false) => {
    setStatus(nextStatus);
    if (['COMPLETED', 'PASSED', 'FAILED'].includes(nextStatus)) completedRef.current = true;
    const response = await fetch('/api/scorm/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ packageId, status: nextStatus, score, runtimeData, csrfToken }),
      keepalive
    });
    if (response.ok) setSaved(true);
  }, [csrfToken, packageId]);

  useEffect(() => {
    void record('IN_PROGRESS', { event: 'launch', launchedAt: new Date().toISOString() });

    const onMessage = (event: MessageEvent) => {
      const payload = readRuntimeMessage(event.data);
      if (!payload?.status) return;
      void record(payload.status, { ...payload.runtimeData, source: 'postMessage' }, payload.score);
    };
    const onPageHide = () => {
      if (!completedRef.current) {
        void record('IN_PROGRESS', { event: 'pagehide', leftAt: new Date().toISOString() }, null, true);
      }
    };

    window.addEventListener('message', onMessage);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [packageId, record]);

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs font-bold text-slate-500 sm:inline">{saved ? `Saved: ${status}` : `Tracking: ${status}`}</span>
      <button
        type="button"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 text-xs font-black text-emerald-100 hover:bg-emerald-500/20"
        onClick={() => record('COMPLETED', { event: 'manual_complete', completedAt: new Date().toISOString() })}
      >
        <CheckCircle2 size={15} />
        Mark complete
      </button>
    </div>
  );
}
