'use client';

import { Check, Copy } from 'lucide-react';
import { useRef, useState } from 'react';

type CopyLinkProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  ariaLabel?: string;
  absolute?: boolean;
};

export function CopyLink({ value, label = 'Copy', copiedLabel = 'Copied', ariaLabel = 'Share link', absolute = true }: CopyLinkProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCopy() {
    const absoluteValue = absolute && !value.startsWith('http') ? `${window.location.origin}${value}` : value;
    try {
      await navigator.clipboard.writeText(absoluteValue);
    } catch {
      inputRef.current?.select();
      document.execCommand('copy');
      inputRef.current?.blur();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex min-w-[260px] max-w-sm items-center gap-2">
      <input
        ref={inputRef}
        className="input h-9 min-w-0 flex-1 px-3 text-xs"
        readOnly
        value={value}
        aria-label={ariaLabel}
      />
      <button className="btn-secondary min-h-9 px-3" type="button" onClick={handleCopy} aria-label={copied ? copiedLabel : label}>
        {copied ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={2} />}
        <span className="hidden sm:inline">{copied ? copiedLabel : label}</span>
      </button>
    </div>
  );
}
