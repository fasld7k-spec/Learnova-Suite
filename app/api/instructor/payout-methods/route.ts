import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { toJson } from '@/lib/json-fields';

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const action = String(form.get('_action') || 'create').trim();
    const id = String(form.get('id') || '').trim();

    if (action === 'delete') {
      if (!id) return fail('Payout method ID is required.', 422);
      await prisma.instructorPayoutMethod.deleteMany({ where: { id, instructorId: user.id } });
      return NextResponse.redirect(new URL('/instructor/payout-methods?deleted=1', req.url), 303);
    }

    if (action === 'set-default') {
      if (!id) return fail('Payout method ID is required.', 422);
      const method = await prisma.instructorPayoutMethod.findFirst({ where: { id, instructorId: user.id } });
      if (!method) return fail('Payout method not found.', 404);
      await prisma.$transaction([
        prisma.instructorPayoutMethod.updateMany({ where: { instructorId: user.id }, data: { active: false } }),
        prisma.instructorPayoutMethod.update({ where: { id }, data: { active: true } }),
      ]);
      return NextResponse.redirect(new URL('/instructor/payout-methods?saved=1', req.url), 303);
    }

    const details = {
      accountName: String(form.get('accountName') || '').trim(),
      email: String(form.get('email') || '').trim(),
      bankName: String(form.get('bankName') || '').trim(),
      accountNumber: String(form.get('accountNumber') || '').trim(),
    };
    const method = String(form.get('method') || 'PayPal').trim();
    if (!['PayPal', 'Bank Transfer', 'Wise'].includes(method)) return fail('Unsupported payout method.', 422);
    if (!details.accountName) return fail('Account holder name is required.', 422);
    if ((method === 'PayPal' || method === 'Wise') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) return fail('A valid payout email is required.', 422);
    if (method === 'Bank Transfer' && (!details.bankName || !details.accountNumber)) return fail('Bank name and account/IBAN are required.', 422);

    if (action === 'update') {
      if (!id) return fail('Payout method ID is required.', 422);
      const updated = await prisma.instructorPayoutMethod.updateMany({
        where: { id, instructorId: user.id },
        data: { method, details: toJson(details) },
      });
      if (!updated.count) return fail('Payout method not found.', 404);
      return NextResponse.redirect(new URL('/instructor/payout-methods?saved=1', req.url), 303);
    }

    const existingCount = await prisma.instructorPayoutMethod.count({ where: { instructorId: user.id } });
    const row = await prisma.instructorPayoutMethod.create({
      data: { instructorId: user.id, method, details: toJson(details), active: existingCount === 0 },
    });
    if (existingCount === 0) await prisma.instructorPayoutMethod.update({ where: { id: row.id }, data: { active: true } });
    return NextResponse.redirect(new URL('/instructor/payout-methods?saved=1', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
