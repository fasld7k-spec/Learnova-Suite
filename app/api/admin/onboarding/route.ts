import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

const defaultLaunchSignoffs = [
  { title: 'Legal pages reviewed', sortOrder: 10 },
  { title: 'Demo credentials verified', sortOrder: 20 },
  { title: 'Checkout sandbox tested', sortOrder: 30 },
  { title: 'Support policy reviewed', sortOrder: 40 },
  { title: 'Production environment variables checked', sortOrder: 50 },
];

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const action = String(form.get('_action') || '').trim();

    if (action !== 'seed-launch-signoffs') return fail('Unsupported onboarding action.', 422);

    let created = 0;
    for (const item of defaultLaunchSignoffs) {
      const existing = await prisma.releaseChecklist.findFirst({ where: { title: item.title } });
      if (existing) continue;
      await prisma.releaseChecklist.create({ data: { ...item, done: false } });
      created += 1;
    }

    await audit({
      actorId: admin.id,
      action: 'onboarding.seed_launch_signoffs',
      entity: 'ReleaseChecklist',
      metadata: { created },
    });

    return NextResponse.redirect(new URL('/admin/onboarding?seeded=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Onboarding action failed.', 500);
  }
}
