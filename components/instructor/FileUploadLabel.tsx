'use client';

import { ChangeEvent, useState } from 'react';
import { UploadCloud } from 'lucide-react';

type FileUploadLabelProps = {
  name: string;
  accept: string;
  title: string;
  hint: string;
  ariaLabel?: string;
};

export function FileUploadLabel({ name, accept, title, hint, ariaLabel }: FileUploadLabelProps) {
  const [fileName, setFileName] = useState('');

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setFileName(event.target.files?.[0]?.name || '');
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 border border-[#2F3336] p-4 transition hover:bg-[#16181C] focus-within:border-[#1D9BF0] focus-within:bg-[#16181C]">
      <UploadCloud className="shrink-0 text-[#1D9BF0]" size={20} strokeWidth={1.8} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="block truncate text-xs text-[#71767B]">{fileName || hint}</span>
      </span>
      <input className="sr-only" name={name} type="file" accept={accept} aria-label={ariaLabel || title} onChange={onChange} />
    </label>
  );
}
