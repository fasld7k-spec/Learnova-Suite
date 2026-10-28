import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function clean(value: string) {
  return value.replace(/\r?\n/g, ' ').replace(/,/g, '\\,');
}

export async function GET() {
  const settings = await getSiteSettings();
  const sessions = await prisma.liveSession.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 100
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${clean(settings.siteName)}//Calendar//EN`,
    ...sessions.flatMap((s) => [
      'BEGIN:VEVENT',
      `UID:${s.id}@${settings.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(s.startsAt)}`,
      `SUMMARY:${clean(s.title)}`,
      `DESCRIPTION:${clean(s.description || '')}`,
      // No join URL: this feed is public, and meeting links are only handed out to enrolled students.
      'END:VEVENT'
    ]),
    'END:VCALENDAR'
  ];

  return new Response(lines.join('\r\n'), {
    headers: { 'content-type': 'text/calendar; charset=utf-8' }
  });
}
