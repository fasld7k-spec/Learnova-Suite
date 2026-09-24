import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

const allowedAudiences = new Set(['ALL', 'STUDENT', 'INSTRUCTOR', 'ADMIN']);

function cleanText(value: FormDataEntryValue | null, fallback = '') {
  return String(value || fallback).trim();
}

async function targetUsers(audience: string) {
  const users = await prisma.user.findMany({
    where: audience === 'ALL' ? { status: 'APPROVED' } : { role: audience as any, status: 'APPROVED' },
    select: { id: true }
  });

  if (!users.length) return users;

  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: { in: users.map((user) => user.id) } },
    select: { userId: true, inApp: true }
  });
  const optedOut = new Set(preferences.filter((preference) => !preference.inApp).map((preference) => preference.userId));
  return users.filter((user) => !optedOut.has(user.id));
}

async function deliverCampaign(campaign: { id: string; title: string; body: string; audience: string }) {
  const users = await targetUsers(campaign.audience);
  if (users.length) {
    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title: campaign.title,
        body: campaign.body
      }))
    });
  }

  await prisma.pushNotificationCampaign.update({
    where: { id: campaign.id },
    data: { status: 'SENT' }
  });

  return users.length;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(cleanText(form.get('csrfToken'))))) return fail('Invalid CSRF token.', 403);
    const action = cleanText(form.get('action'), 'create');

    if (action === 'send') {
      const campaignId = cleanText(form.get('campaignId'));
      if (!campaignId) return fail('Campaign id is required.', 422);

      const campaign = await prisma.pushNotificationCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) return fail('Campaign not found.', 404);
      if (campaign.status === 'SENT') {
        return NextResponse.redirect(new URL('/admin/push-campaigns?sent=already', req.url), 303);
      }

      const count = await deliverCampaign(campaign);
      await audit({ actorId: admin.id, action: 'push_campaign.send', entity: 'PushNotificationCampaign', entityId: campaign.id, metadata: { delivered: count } });
      return NextResponse.redirect(new URL(`/admin/push-campaigns?sent=${count}`, req.url), 303);
    }

    const title = cleanText(form.get('title'));
    const body = cleanText(form.get('body'));
    const audience = cleanText(form.get('audience'), 'ALL').toUpperCase();
    const sendNow = form.get('sendNow') === 'on';

    if (!title) return fail('Campaign title is required.', 422);
    if (!body) return fail('Campaign message is required.', 422);
    if (!allowedAudiences.has(audience)) return fail('Campaign audience is invalid.', 422);

    const campaign = await prisma.pushNotificationCampaign.create({
      data: {
        title,
        body,
        audience,
        status: sendNow ? 'QUEUED' : 'DRAFT'
      }
    });

    if (sendNow) {
      const count = await deliverCampaign(campaign);
      await audit({ actorId: admin.id, action: 'push_campaign.create_and_send', entity: 'PushNotificationCampaign', entityId: campaign.id, metadata: { audience, delivered: count } });
      return NextResponse.redirect(new URL(`/admin/push-campaigns?sent=${count}`, req.url), 303);
    }

    await audit({ actorId: admin.id, action: 'push_campaign.create', entity: 'PushNotificationCampaign', entityId: campaign.id, metadata: { audience } });
    return NextResponse.redirect(new URL('/admin/push-campaigns?created=1', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
