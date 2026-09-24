import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { parseCsvRows } from '@/lib/simple-csv';
import { verifyCsrf } from '@/lib/csrf';

const maxImportSize = 2 * 1024 * 1024;

async function importText(form: FormData) {
  const file = form.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > maxImportSize) throw new Error('CSV file must be 2MB or smaller.');
    return file.text();
  }
  return String(form.get('csv') || '');
}

function parseRows(text: string) {
  return parseCsvRows(text)
    .filter((row, index) => !(index === 0 && row[0]?.toLowerCase() === 'nameen' && row[1]?.toLowerCase() === 'namear' && row[2]?.toLowerCase() === 'slug'));
}

function cleanSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const rows = parseRows(await importText(form));
    if (!rows.length) return fail('Add CSV rows or upload a CSV file.', 422);

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const [nameEnRaw, nameArRaw, slugRaw] = row;
      const nameEn = String(nameEnRaw || '').trim();
      const slug = cleanSlug(String(slugRaw || nameEn));
      if (!nameEn || !slug) {
        skipped += 1;
        continue;
      }

      await prisma.category.upsert({
        where: { slug },
        update: { nameEn, nameAr: String(nameArRaw || nameEn).trim() || nameEn },
        create: { nameEn, nameAr: String(nameArRaw || nameEn).trim() || nameEn, slug },
      });
      imported += 1;
    }

    if (imported > 0) await invalidateCourseCatalogCache();

    await audit({
      actorId: admin.id,
      action: 'import.categories',
      entity: 'category',
      metadata: { imported, skipped },
    });

    const url = new URL('/admin/import', req.url);
    url.searchParams.set('categoriesImported', String(imported));
    if (skipped) url.searchParams.set('skipped', String(skipped));
    return NextResponse.redirect(url, 303);
  } catch (error: any) {
    return fail(error.message || 'Categories import failed.', 500);
  }
}
