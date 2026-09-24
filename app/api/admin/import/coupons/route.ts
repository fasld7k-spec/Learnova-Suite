import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
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
    .filter((row, index) => !(index === 0 && row[0]?.toLowerCase() === 'code'));
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

function parsePositiveInt(value: string) {
  const number = Number(value || 0);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseActive(value: string) {
  if (!value) return true;
  return ['true', '1', 'yes', 'active', 'on'].includes(value.toLowerCase());
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
      const [codeRaw, discountTypeRaw, percentRaw, amountRaw, startsAtRaw, expiresAtRaw, maxUsesRaw, perUserLimitRaw, minOrderAmountRaw, activeRaw] = row;
      const code = String(codeRaw || '').trim().toUpperCase();
      const discountType = String(discountTypeRaw || 'PERCENT').trim().toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT';
      const percent = Number(percentRaw || 0);
      const amount = Number(amountRaw || 0);
      const minOrderAmount = Number(minOrderAmountRaw || 0);

      if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) {
        skipped += 1;
        continue;
      }
      if (discountType === 'PERCENT' && (!Number.isInteger(percent) || percent < 1 || percent > 100)) {
        skipped += 1;
        continue;
      }
      if (discountType === 'FIXED' && (!Number.isFinite(amount) || amount <= 0)) {
        skipped += 1;
        continue;
      }
      if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
        skipped += 1;
        continue;
      }

      const data = {
        discountType,
        percent: discountType === 'PERCENT' ? percent : 0,
        amount: discountType === 'FIXED' ? amount : 0,
        startsAt: parseDate(String(startsAtRaw || '').trim()),
        expiresAt: parseDate(String(expiresAtRaw || '').trim()),
        maxUses: parsePositiveInt(String(maxUsesRaw || '').trim()),
        perUserLimit: parsePositiveInt(String(perUserLimitRaw || '').trim()),
        minOrderAmount,
        active: parseActive(String(activeRaw || '').trim()),
      };

      await prisma.coupon.upsert({
        where: { code },
        update: data,
        create: { code, ...data },
      });
      imported += 1;
    }

    await audit({
      actorId: admin.id,
      action: 'import.coupons',
      entity: 'coupon',
      metadata: { imported, skipped },
    });

    const url = new URL('/admin/import', req.url);
    url.searchParams.set('couponsImported', String(imported));
    if (skipped) url.searchParams.set('skipped', String(skipped));
    return NextResponse.redirect(url, 303);
  } catch (error: any) {
    return fail(error.message || 'Coupons import failed.', 500);
  }
}
