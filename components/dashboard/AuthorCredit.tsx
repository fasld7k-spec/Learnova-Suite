import { AUTHOR_NAME, AUTHOR_URL } from '@/lib/constants';

// Attribution required by the NOTICE file (Apache License 2.0, section 4(d)).
export function AuthorCredit() {
  return (
    <footer className="mt-10 border-t border-white/10 pt-4 text-center text-xs font-semibold text-slate-400">
      Design &amp; development by{' '}
      <a className="font-black text-violet-300 hover:underline" href={AUTHOR_URL} rel="noopener" target="_blank">
        {AUTHOR_NAME}
      </a>
      {' · '}
      <span dir="rtl">تصميم وبرمجة م. سيد أفندي</span>
    </footer>
  );
}
