import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { runDatabaseBackup } from '@/lib/backups';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const result = await runDatabaseBackup();

    const log = await prisma.backupLog.create({
      data: {
        type: result.type,
        status: result.status,
        message: result.message,
      },
    });
    await audit({
      actorId: admin.id,
      action: 'backup.run',
      entity: 'BackupLog',
      entityId: log.id,
      metadata: { type: result.type, status: result.status },
    });

    return NextResponse.redirect(new URL('/admin/backups', req.url), 303);
  } catch (error: any) {
    await prisma.backupLog.create({
      data: {
        type: 'manual',
        status: 'FAILED',
        message: error.message || 'Backup failed',
      },
    }).catch(() => null);
    return fail(error.message || 'Backup failed', 500);
  }
}
