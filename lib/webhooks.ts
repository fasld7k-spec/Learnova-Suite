import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/secret-fields';

export class WebhookVerificationError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

function envWebhookSecret(provider: string) {
  const key = `${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_WEBHOOK_SECRET`;
  return process.env[key] || process.env.WEBHOOK_SECRET || '';
}

function configWebhookSecret(config: Record<string, unknown>) {
  const secret =
    config.webhookSecret ||
    config.webhookSigningSecret ||
    config.signingSecret ||
    config.endpointSecret;
  return typeof secret === 'string' ? decryptSecret(secret).trim() : '';
}

export async function providerWebhookSecret(provider: string) {
  const slug = provider.trim().toLowerCase();
  const row = slug ? await prisma.paymentMethod.findUnique({ where: { slug } }).catch(() => null) : null;
  const adminSecret = configWebhookSecret(fromJsonObject(row?.config));
  return adminSecret || envWebhookSecret(provider);
}

function normalizeSignature(signature: string) {
  return signature.replace(/^sha256=/i, '').trim();
}

function verifyHmac(rawBody: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = normalizeSignature(signature);
  const expectedBytes = Buffer.from(expected, 'hex');
  const actualBytes = Buffer.from(actual, 'hex');
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  const actualBytes = Buffer.from(signature, 'hex');
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export async function readSignedWebhookJson(req: NextRequest, provider: string) {
  const rawBody = await req.text();
  const secret = await providerWebhookSecret(provider);
  if (!secret) {
    throw new WebhookVerificationError('Webhook secret is not configured', 503);
  }

  const stripeSignature = req.headers.get('stripe-signature');
  if (provider === 'stripe' && stripeSignature) {
    if (!verifyStripeSignature(rawBody, stripeSignature, secret)) {
      throw new WebhookVerificationError('Invalid Stripe webhook signature');
    }
    try {
      return JSON.parse(rawBody || '{}');
    } catch {
      throw new WebhookVerificationError('Invalid webhook JSON', 400);
    }
  }

  const signature = req.headers.get('x-learnova-signature') || req.headers.get('x-webhook-signature');
  if (!signature || !verifyHmac(rawBody, signature, secret)) {
    throw new WebhookVerificationError('Invalid webhook signature');
  }

  try {
    return JSON.parse(rawBody || '{}');
  } catch {
    throw new WebhookVerificationError('Invalid webhook JSON', 400);
  }
}
