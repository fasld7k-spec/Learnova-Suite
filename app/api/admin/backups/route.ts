import { readFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { deleteLocalBackupFile, resolveBackupFile } from '@/lib/backups';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function field(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function redirect(req: NextRequest, query = '') {
  return NextResponse.redirect(new URL(`/admin/backups${query}`, req.url), 303);
}

export async function GET(req: NextRequest) {
  try {
    await requireUser(['ADMIN']);
    const fileName = req.nextUrl.searchParams.get('file') || '';
    if (!fileName) return fail('Backup file is required.', 422);

    const filePath = resolveBackupFile(fileName);
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(field(form, 'csrfToken')))) return fail('Invalid CSRF token.', 403);

    const action = field(form, '_action');

    if (action === 'delete_file') {
      const fileName = field(form, 'file');
      if (!fileName) return fail('Backup file is required.', 422);
      await deleteLocalBackupFile(fileName);
      await audit({ actorId: admin.id, action: 'backup.file.delete', entity: 'BackupFile', entityId: fileName });
      return redirect(req, '?deleted=1');
    }

    if (action === 'delete_log') {
      const id = field(form, 'id');
      if (!id) return fail('Backup log id is required.', 422);
      await prisma.backupLog.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'backup.log.delete', entity: 'BackupLog', entityId: id });
      return redirect(req, '?logDeleted=1');
    }

    if (action === 'clear_failed_logs') {
      const result = await prisma.backupLog.deleteMany({ where: { status: 'FAILED' } });
      await audit({ actorId: admin.id, action: 'backup.logs.clear_failed', entity: 'BackupLog', metadata: { deleted: result.count } });
      return redirect(req, '?logsCleared=1');
    }

    return fail('Unsupported backup action.', 422);
  } catch (error) {
    return handleError(error);
  }
}
