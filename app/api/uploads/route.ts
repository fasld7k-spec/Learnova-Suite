import { fail, handleError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { saveFileToStorage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'video/mp4'];
const maxUploadBytes = 1024 * 1024 * 500;

export async function POST(req: NextRequest) {
  try {
    await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const file = form.get('file') as File | null;

    if (!file) return fail('File is required', 422);
    if (!allowed.includes(file.type)) return fail('Unsupported file type', 422);
    if (file.size > maxUploadBytes) return fail('File too large', 422);

    const uploaded = await saveFileToStorage(file, {
      allowedTypes: allowed,
      maxBytes: maxUploadBytes,
      purpose: 'Upload'
    });

    const payload = { message: 'Upload complete.', name: file.name, type: file.type, size: file.size, url: uploaded?.url, key: uploaded?.key };
    if (!req.headers.get('accept')?.includes('application/json')) {
      const refererPath = new URL(req.headers.get('referer') || '/admin/media', req.url).pathname;
      const target = refererPath === '/admin/upload-test' ? '/admin/upload-test' : '/admin/media';
      return NextResponse.redirect(new URL(`${target}?uploaded=${encodeURIComponent(uploaded?.url || '')}`, req.url), 303);
    }
    return ok(payload);
  } catch (error) {
    return handleError(error);
  }
}
