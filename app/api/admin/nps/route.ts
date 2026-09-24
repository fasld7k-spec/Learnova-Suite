import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function scoreRange(segment: string) {
  if (segment === 'promoters') return { gte: 9, lte: 10 };
  if (segment === 'passives') return { gte: 7, lte: 8 };
  if (segment === 'detractors') return { gte: 0, lte: 6 };
  return null;
}

export async function GET() {
  try {
    const admin = await requireUser(['ADMIN']);
    const responses = await prisma.npsResponse.findMany({ orderBy: { createdAt: 'desc' } });
    const users = responses.length
      ? await prisma.user.findMany({
          where: { id: { in: responses.map((response) => response.userId).filter(Boolean) as string[] } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    const rows = [
      ['id', 'user_name', 'user_email', 'score', 'segment', 'comment', 'created_at'],
      ...responses.map((response) => {
        const user = response.userId ? userMap.get(response.userId) : null;
        const segment = response.score >= 9 ? 'promoter' : response.score >= 7 ? 'passive' : 'detractor';
        return [
          response.id,
          user?.name || 'Guest',
          user?.email || '',
          response.score,
          segment,
          response.comment || '',
          response.createdAt.toISOString(),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    await audit({ actorId: admin.id, action: 'nps.export', entity: 'npsResponse', metadata: { rows: responses.length } });
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="nps-responses.csv"',
      },
    });
  } catch (error: any) {
    return fail(error.message || 'NPS export failed.', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const action = String(form.get('_action') || '').trim();

    if (action === 'clear') {
      const result = await prisma.npsResponse.deleteMany({});
      await audit({ actorId: admin.id, action: 'nps.clear', entity: 'npsResponse', metadata: { deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/nps?cleared=1', req.url), 303);
    }

    if (action === 'purge-segment') {
      const segment = String(form.get('segment') || '').trim();
      const range = scoreRange(segment);
      if (!range) return fail('NPS segment is required.', 422);
      const result = await prisma.npsResponse.deleteMany({ where: { score: range } });
      await audit({ actorId: admin.id, action: 'nps.purge_segment', entity: 'npsResponse', metadata: { segment, deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/nps?purged=1', req.url), 303);
    }

    if (action === 'delete') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('NPS response ID is required.', 422);
      const response = await prisma.npsResponse.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'nps.delete', entity: 'npsResponse', entityId: response.id, metadata: { score: response.score, userId: response.userId } });
      return NextResponse.redirect(new URL('/admin/nps?deleted=1', req.url), 303);
    }

    return fail('Unsupported NPS action.', 422);
  } catch (error: any) {
    return fail(error.message || 'NPS action failed.', 500);
  }
}
