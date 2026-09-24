import { NextRequest } from 'next/server';

import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    await requireUser(['ADMIN']);
    const params = req.nextUrl.searchParams;
    const result = params.get('result') || '';
    const email = params.get('email')?.trim() || '';
    const where = {
      ...(result === 'success' ? { success: true } : {}),
      ...(result === 'failed' ? { success: false } : {}),
      ...(email ? { email: { contains: email } } : {}),
    };
    const rows = await prisma.loginHistory.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10000 });
    return csvResponse(
      `login-history-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['id', 'email', 'userId', 'success', 'ip', 'userAgent', 'createdAt'],
        rows.map((row) => [
          row.id,
          row.email,
          row.userId || '',
          row.success ? 'success' : 'failed',
          row.ip || '',
          row.userAgent || '',
          row.createdAt.toISOString(),
        ]),
      ),
    );
  } catch (error: any) {
    return fail(error.message || 'Login history export failed.', 500);
  }
}
