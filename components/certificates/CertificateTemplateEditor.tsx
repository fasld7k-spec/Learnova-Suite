'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  certificateTemplatePreviewVariables,
  renderCertificateTemplate,
} from '@/lib/certificate-templates';
import { errorMessage } from '@/lib/errors';

function renderPreview(html: string) {
  try {
    return { html: renderCertificateTemplate(html, certificateTemplatePreviewVariables), error: '' };
  } catch (error: unknown) {
    return { html: '', error: errorMessage(error, 'Unable to render preview') };
  }
}

export function CertificateTemplatePreview({ html, compact = false }: { html: string; compact?: boolean }) {
  const preview = useMemo(() => renderPreview(html), [html]);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(compact ? 0.26 : 0.42);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const availableWidth = Math.max(260, frame.clientWidth - 24);
      setScale(Math.min(1, Math.max(0.22, availableWidth / 1080)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={compact ? 'grid gap-2' : 'grid gap-3'}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-black text-white">Preview</span>
        <span className="rounded-full border border-[#2F3336] px-2.5 py-1 text-xs font-bold text-[#71767B]">
          Sample data
        </span>
      </div>
      <div ref={frameRef} className={`overflow-hidden border border-[#2F3336] bg-white ${compact ? 'h-56' : 'h-[460px]'}`}>
        {preview.error ? (
          <div className="grid h-full place-items-center p-5 text-center text-sm font-bold text-[#F4212E]">
            {preview.error}
          </div>
        ) : (
          <div
            className="m-3 text-black"
            style={{ width: 1080, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        )}
      </div>
    </div>
  );
}

export function CertificateTemplateEditor({
  defaultHtml,
  compact = false,
}: {
  defaultHtml: string;
  compact?: boolean;
}) {
  const [html, setHtml] = useState(defaultHtml);

  return (
    <div className={compact ? 'grid gap-3' : 'grid gap-4 xl:grid-cols-2'}>
      <label className="grid gap-2">
        <span className="text-sm font-bold text-[#E7E9EA]">HTML template</span>
        <textarea
          className={`input font-mono text-xs leading-6 ${compact ? 'min-h-44' : 'min-h-[460px]'}`}
          name="html"
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          required
        />
      </label>
      <CertificateTemplatePreview html={html} compact={compact} />
    </div>
  );
}
