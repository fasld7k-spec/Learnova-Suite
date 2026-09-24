import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function formUrl(form: FormData, key: string, label: string) {
  return validateStoredUrl(String(form.get(key) || ''), { label, allowRelative: true });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const title = cleanText(f.get('title'), 140);
    const description = cleanText(f.get('description'), 600);

    if (!title) return fail('Project title is required.', 400);

    await prisma.portfolioProject.create({
      data: {
        userId: user.id,
        title,
        description,
        url: formUrl(f, 'url', 'Project URL'),
        imageUrl: formUrl(f, 'imageUrl', 'Project image URL'),
        public: f.get('public') === 'on'
      }
    });
    return NextResponse.redirect(new URL('/student/portfolio', req.url), 303);
  } catch (e: any) {
    const message = e?.message || 'Unable to save portfolio project';
    return fail(message, message.includes('URL') ? 422 : 500);
  }
}
