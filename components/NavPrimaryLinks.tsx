'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavPrimaryLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link key={href} href={href} className="relative text-[13px] font-bold text-slate-200 transition hover:text-white">
            {label}
            {active && <span className="absolute -bottom-3 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-violet-500" />}
          </Link>
        );
      })}
    </>
  );
}
