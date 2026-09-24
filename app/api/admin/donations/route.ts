import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/donations', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function positiveMoney(form: FormData, key: string) {
  const amount = Number(form.get(key) || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${key} must be a valid non-negative amount.`);
  return amount;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Campaign id is required.', 422);
      await prisma.donation.deleteMany({ where: { campaignId: id } });
      await prisma.donationCampaign.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'donation_campaign.delete', entity: 'DonationCampaign', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Campaign id is required.', 422);
      const current = await prisma.donationCampaign.findUnique({ where: { id } });
      if (!current) return fail('Campaign not found.', 404);
      const campaign = await prisma.donationCampaign.update({ where: { id }, data: { active: !current.active } });
      await audit({
        actorId: admin.id,
        action: campaign.active ? 'donation_campaign.enable' : 'donation_campaign.disable',
        entity: 'DonationCampaign',
        entityId: id,
      });
      return redirect(req);
    }

    const title = value(form, 'title');
    const description = value(form, 'description');
    const goal = positiveMoney(form, 'goal');
    if (title.length < 3) return fail('Campaign title must be at least 3 characters.', 422);
    if (description.length < 10) return fail('Campaign description must be at least 10 characters.', 422);

    const data = { title, description, goal, active: form.get('active') === 'on' };
    if (action === 'update') {
      if (!id) return fail('Campaign id is required.', 422);
      await prisma.donationCampaign.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'donation_campaign.update', entity: 'DonationCampaign', entityId: id });
      return redirect(req);
    }

    const campaign = await prisma.donationCampaign.create({ data });
    await audit({ actorId: admin.id, action: 'donation_campaign.create', entity: 'DonationCampaign', entityId: campaign.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Donation campaign update failed.', 500);
  }
}
