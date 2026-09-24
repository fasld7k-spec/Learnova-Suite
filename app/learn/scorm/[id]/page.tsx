import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ScormAttemptTracker } from '@/components/learn/ScormAttemptTracker';
import { isEnrolled } from '@/lib/enrollment';
import { requireUser } from '@/lib/auth';
import { getCsrfToken } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export default async function ScormLaunch(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requireUser(['STUDENT', 'ADMIN']);
  const csrfToken = await getCsrfToken();
  const pkg = await prisma.scormPackage.findUnique({ where: { id: params.id } });
  if (!pkg || !pkg.active) notFound();
  if (user.role === 'STUDENT' && !(await isEnrolled(user.id, pkg.courseId))) notFound();

  return (
    <main className="grid h-screen grid-rows-[64px_1fr] bg-black text-white">
      <header className="flex items-center justify-between border-b border-[#2F3336] px-4">
        <a className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition hover:bg-[#16181C]" href="/student/courses">
          <ArrowLeft size={16} />
          Courses
        </a>
        <h1 className="truncate px-4 text-sm font-black">{pkg.title}</h1>
        {user.role === 'STUDENT' ? <ScormAttemptTracker packageId={pkg.id} csrfToken={csrfToken} /> : <span className="w-20" />}
      </header>
      <iframe src={pkg.launchUrl} className="h-full w-full border-0 bg-black" title={pkg.title} />
    </main>
  );
}
