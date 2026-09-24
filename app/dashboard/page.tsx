import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardRouter() {
  const session = await getSession();
  if (!session) redirect('/login?next=/dashboard');

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true },
  });
  if (!user) redirect('/login?status=signed-out');

  if (user.role === 'ADMIN') redirect('/admin');
  if (user.role === 'INSTRUCTOR') redirect('/instructor');
  redirect('/student');
}
