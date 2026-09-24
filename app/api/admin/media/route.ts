import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { deleteLocalMediaAsset } from '@/lib/admin-media';
import { requireUser } from '@/lib/auth';
import { saveFileToStorage } from '@/lib/storage';
import { verifyCsrf } from '@/lib/csrf';

const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'video/mp4'];
const maxUploadBytes = 1024 * 1024 * 500;

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action');

    if (action === 'upload') {
      const uploaded = await saveFileToStorage(form.get('file') as File | null, {
        allowedTypes,
        maxBytes: maxUploadBytes,
        purpose: 'Admin media upload'
      });
      if (!uploaded) return fail('File is required.', 422);
      await audit({ actorId: admin.id, action: 'media.upload', entity: 'MediaAsset', entityId: uploaded.url, metadata: { url: uploaded.url, key: uploaded.key } });
      const target = value(form, 'returnTo') === 'upload-test' ? '/admin/upload-test' : '/admin/media';
      return NextResponse.redirect(new URL(`${target}?uploaded=${encodeURIComponent(uploaded.url)}`, req.url), 303);
    }

    if (action !== 'delete') return fail('Unsupported media action.', 422);

    const url = value(form, 'url');
    if (!url) return fail('Media URL is required.', 422);

    await deleteLocalMediaAsset(url);
    await audit({ actorId: admin.id, action: 'media.delete', entity: 'MediaAsset', entityId: url, metadata: { url } });
    return NextResponse.redirect(new URL('/admin/media?deleted=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Media action failed.', 500);
  }
}
