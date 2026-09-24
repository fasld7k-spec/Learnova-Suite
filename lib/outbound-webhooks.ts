import { createHash, createHmac } from 'crypto';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/secret-fields';
import { assertSafeServerUrl } from '@/lib/egress-url';

export type PlatformWebhookEvent =
  | 'order.paid'
  | 'certificate.issued'
  | 'live-session.created'
  | 'live-session.updated'
  | 'live-session.deleted';

type DispatchEndpoint = {
  id: string;
  url: string;
  secret: string | null;
  provider?: string;
};

function deliveryBody(endpoint: DispatchEndpoint, event: PlatformWebhookEvent, payload: Record<string, unknown>) {
  if (endpoint.provider === 'slack') {
    return JSON.stringify({
      text: `Learnova event: ${event}`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*Learnova event:* ${event}` } },
        { type: 'section', text: { type: 'mrkdwn', text: `\`\`\`${JSON.stringify(payload, null, 2).slice(0, 2500)}\`\`\`` } },
      ],
    });
  }

  return JSON.stringify({
    event,
    sentAt: new Date().toISOString(),
    payload,
  });
}

async function sendEndpoint(endpoint: DispatchEndpoint, event: PlatformWebhookEvent, payload: Record<string, unknown>) {
  const body = deliveryBody(endpoint, event, payload);
  const secret = decryptSecret(endpoint.secret);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-learnova-event': event,
  };
  if (secret) headers['x-learnova-signature'] = createHmac('sha256', secret).update(body).digest('hex');

  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      event,
      payload: toJson(payload),
      status: 'PENDING',
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = await assertSafeServerUrl(endpoint.url, { label: 'Webhook URL' });
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    });
    const text = await response.text().catch(() => '');
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: response.ok ? 'SUCCESS' : 'FAILED',
        response: `${response.status} ${text.slice(0, 1000)}`.trim(),
      },
    });
  } catch (error) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        response: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => null);
  } finally {
    clearTimeout(timeout);
  }
}

function mailchimpDataCenter(apiKey: string) {
  const [, dc] = apiKey.split('-');
  if (!dc || !/^[a-z0-9-]+$/i.test(dc)) throw new Error('Mailchimp API key must include a data center suffix such as -us21.');
  return dc.toLowerCase();
}

async function syncMailchimpSubscriber(integration: { id: string; config: string }, event: PlatformWebhookEvent, payload: Record<string, unknown>) {
  if (event !== 'order.paid') return false;
  const config = fromJsonObject<Record<string, unknown>>(integration.config);
  const audienceId = String(config.audienceId || '').trim();
  const apiKey = decryptSecret(String(config.apiKey || config.secretKey || ''));
  if (!audienceId || !apiKey) return false;

  const userId = String(payload.userId || '').trim();
  const userEmail = String(payload.userEmail || '').trim();
  const userName = String(payload.userName || '').trim();
  const user = userEmail
    ? { email: userEmail, name: userName }
    : userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }).catch(() => null)
      : null;
  if (!user?.email) return false;

  const dc = mailchimpDataCenter(apiKey);
  const email = user.email.trim().toLowerCase();
  const subscriberHash = createHash('md5').update(email).digest('hex');
  const body = JSON.stringify({
    email_address: email,
    status_if_new: 'subscribed',
    status: 'subscribed',
    merge_fields: {
      FNAME: user.name?.split(' ')[0] || '',
      LNAME: user.name?.split(' ').slice(1).join(' ') || '',
      ORDERID: String(payload.orderId || ''),
    },
    tags: ['Learnova Customer', String(payload.currency || '').trim()].filter(Boolean),
  });

  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId: integration.id,
      event: 'mailchimp.order.paid',
      payload: toJson({ event, payload: { orderId: payload.orderId, userId: payload.userId, email } }),
      status: 'PENDING',
    },
  });

  try {
    const response = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(audienceId)}/members/${subscriberHash}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`learnova:${apiKey}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body,
      redirect: 'manual',
    });
    const text = await response.text().catch(() => '');
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: response.ok ? 'SUCCESS' : 'FAILED',
        response: `${response.status} ${text.slice(0, 1000)}`.trim(),
      },
    });
  } catch (error) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', response: error instanceof Error ? error.message : String(error) },
    }).catch(() => null);
  }
  return true;
}

export async function dispatchPlatformWebhook(event: PlatformWebhookEvent, payload: Record<string, unknown>) {
  const [webhookEndpoints, integrations] = await Promise.all([
    prisma.webhookEndpoint.findMany({
      where: { active: true },
      select: { id: true, url: true, secret: true },
    }),
    prisma.integrationSetting.findMany({
      where: { active: true, provider: { in: ['zapier', 'slack', 'mailchimp'] } },
      select: { id: true, provider: true, config: true },
    }).catch(() => []),
  ]);
  const integrationEndpoints = integrations
    .filter((integration) => integration.provider !== 'mailchimp')
    .map((integration) => {
      const config = fromJsonObject<Record<string, unknown>>(integration.config);
      const url = String(config.webhookUrl || '').trim();
      if (!url) return null;
      return {
        id: integration.id,
        url,
        secret: String(config.webhookSecret || ''),
        provider: integration.provider,
      };
    })
    .filter(Boolean) as DispatchEndpoint[];
  const endpoints: DispatchEndpoint[] = [...webhookEndpoints, ...integrationEndpoints];
  const mailchimpIntegrations = integrations.filter((integration) => integration.provider === 'mailchimp');
  const mailchimpResults = await Promise.allSettled(mailchimpIntegrations.map((integration) => syncMailchimpSubscriber(integration, event, payload)));
  await Promise.allSettled(endpoints.map((endpoint) => sendEndpoint(endpoint, event, payload)));
  return { delivered: endpoints.length + mailchimpResults.filter((result) => result.status === 'fulfilled' && result.value).length };
}

export async function retryWebhookDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new Error('Webhook delivery was not found.');
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: delivery.endpointId },
    select: { id: true, url: true, secret: true, active: true },
  });
  if (!endpoint) {
    const integration = await prisma.integrationSetting.findUnique({
      where: { id: delivery.endpointId },
      select: { id: true, provider: true, config: true, active: true },
    });
    if (!integration) throw new Error('Webhook endpoint was not found.');
    if (!integration.active) throw new Error('Webhook endpoint is disabled.');
    const config = fromJsonObject<Record<string, unknown>>(integration.config);
    const url = String(config.webhookUrl || '').trim();
    if (!url) throw new Error('Integration webhook URL is not configured.');
    await sendEndpoint(
      { id: integration.id, url, secret: String(config.webhookSecret || ''), provider: integration.provider },
      delivery.event as PlatformWebhookEvent,
      fromJsonObject(delivery.payload),
    );
    return { retried: true };
  }
  if (!endpoint.active) throw new Error('Webhook endpoint is disabled.');

  await sendEndpoint(
    { id: endpoint.id, url: endpoint.url, secret: endpoint.secret },
    delivery.event as PlatformWebhookEvent,
    fromJsonObject(delivery.payload),
  );
  return { retried: true };
}
