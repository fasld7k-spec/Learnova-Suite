import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { deleteStoredFile, saveFileToStorage } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const probe = new File(
      [Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')],
      'learnova-upload-probe.png',
      { type: 'image/png' },
    );
    const uploaded = await saveFileToStorage(probe, {
      directory: 'diagnostics',
      allowedTypes: ['image/png'],
      maxBytes: 1024,
      purpose: 'Upload diagnostics probe',
    });
    if (!uploaded) return fail('Upload diagnostics probe did not create a file.', 500);
    await deleteStoredFile(uploaded.key);
    await audit({ actorId: admin.id, action: 'upload_diagnostics.probe', entity: 'Storage', metadata: { key: uploaded.key, url: uploaded.url } });

    const url = new URL('/admin/upload-test', req.url);
    url.searchParams.set('probe', 'ok');
    return NextResponse.redirect(url, 303);
  } catch (error: any) {
    const url = new URL('/admin/upload-test', req.url);
    url.searchParams.set('probeError', error.message || 'Storage probe failed.');
    return NextResponse.redirect(url, 303);
  }
}
