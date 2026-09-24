import { Globe2 } from 'lucide-react';

export function LanguageSwitcher({ code, name }: { code: string; name: string }) {
  return (
    <span
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#2F3336] bg-black px-3 text-sm font-semibold uppercase text-white"
      title={`Active site language: ${name}`}
      aria-label={`Active site language: ${name}`}
    >
      <Globe2 size={15} strokeWidth={1.8} className="text-[#1D9BF0]" />
      {code}
    </span>
  );
}
