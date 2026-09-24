import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getEmbedSettings } from '@/lib/embed-settings';
import { prisma } from '@/lib/prisma';

const money = (value: unknown) => Number(value || 0).toFixed(2);

function originFrom(value: string | null) {
  if (!value) return '';
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return '';
  }
}

function allowedEmbedOrigin(origin: string, allowedDomains: string) {
  if (!origin) return true;
  const rules = allowedDomains.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!rules.length || rules.includes('*')) return true;

  return rules.some((rule) => {
    if (rule === origin) return true;
    if (!rule.includes('*')) return origin === originFrom(rule);
    try {
      const url = new URL(rule.replace('*.', 'wildcard.'));
      const originUrl = new URL(origin);
      const suffix = url.hostname.replace(/^wildcard\./, '');
      return url.protocol === originUrl.protocol && (originUrl.hostname === suffix || originUrl.hostname.endsWith(`.${suffix}`));
    } catch {
      return false;
    }
  });
}

export default async function EmbedCourse(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const [course, settings] = await Promise.all([
    prisma.course.findUnique({
      where: { slug: params.slug },
      include: { instructor: true, category: true }
    }),
    getEmbedSettings(),
  ]);

  if (!course || !settings.enabled) notFound();
  const requestHeaders = await headers();
  const requestOrigin = originFrom(requestHeaders.get('origin')) || originFrom(requestHeaders.get('referer'));
  if (!allowedEmbedOrigin(requestOrigin, settings.allowedDomains)) notFound();

  const light = settings.theme === 'light';
  const brand = settings.theme === 'brand';
  const bg = light ? 'bg-white' : brand ? 'bg-[#06111D]' : 'bg-black';
  const panel = light ? 'border-[#D0D7DE] bg-white text-[#0F1419]' : brand ? 'border-[#1D9BF0]/40 bg-[#06111D] text-white' : 'border-[#2F3336] bg-black text-white';
  const muted = light ? 'text-[#536471]' : 'text-[#71767B]';

  return (
    <main className={`min-h-screen ${bg} p-4 ${light ? 'text-[#0F1419]' : 'text-white'}`}>
      <a
        target="_blank"
        href={`/courses/${course.slug}`}
        className={`block border p-5 transition ${panel} ${light ? 'hover:bg-[#F7F9F9]' : 'hover:bg-[#16181C]'}`}
      >
        <div className={`aspect-video border ${light ? 'border-[#D0D7DE] bg-[#EFF3F4]' : 'border-[#2F3336] bg-[#16181C]'}`} />
        <p className="mt-4 text-xs font-bold uppercase text-[#1D9BF0]">{course.category.nameEn}</p>
        <h1 className={`mt-2 text-xl font-black leading-tight ${light ? 'text-[#0F1419]' : 'text-white'}`}>{course.title}</h1>
        <p className={`mt-3 line-clamp-2 text-sm leading-6 ${muted}`}>{course.shortDescription}</p>
        <div className={`mt-5 flex items-center justify-between border-t pt-4 text-sm ${light ? 'border-[#D0D7DE]' : 'border-[#2F3336]'}`}>
          <span className={`font-bold ${light ? 'text-[#0F1419]' : 'text-white'}`}>{course.instructor.name}</span>
          <b className="rounded-full bg-[#1D9BF0] px-4 py-2 text-white">${money(course.salePrice ?? course.price)}</b>
        </div>
        <p className={`mt-4 text-center text-xs font-black uppercase tracking-wide ${light ? 'text-[#0F1419]' : 'text-white'}`}>{settings.ctaLabel}</p>
      </a>
    </main>
  );
}
