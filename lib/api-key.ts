import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';

import { fail } from '@/lib/api';
import { fromJsonArray, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export const publicApiScopes = [
  { value: 'courses:read', label: 'Read public courses' },
] as const;

export function normalizeApiScopes(values: unknown[]) {
  const allowed = new Set(publicApiScopes.map((scope) => scope.value));
  const scopes = Array.from(new Set(values.map(String).filter((value) => allowed.has(value as any))));
  return scopes.length ? scopes : ['courses:read'];
}

export function serializeApiScopes(values: unknown[]) {
  return toJson(normalizeApiScopes(values));
}

export function generateApiKey() {
  return `emp_${randomBytes(24).toString('hex')}`;
}

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

function requestIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

export async function recordApiUsage({
  apiKeyId,
  req,
  status,
}: {
  apiKeyId?: string | null;
  req: NextRequest;
  status: number;
}) {
  await prisma.apiUsageLog.create({
    data: {
      apiKeyId: apiKeyId || null,
      path: req.nextUrl.pathname,
      method: req.method,
      status,
    },
  }).catch(() => null);
}

export async function requireApiKey(req: NextRequest, requiredScope?: string) {
  const limited = rateLimit(`public-api:${requestIp(req)}`, 120, 60_000);
  if (!limited.ok) {
    await recordApiUsage({ req, status: 429 });
    return { ok: false as const, response: fail('Too many API requests.', 429) };
  }

  const key = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!key) {
    await recordApiUsage({ req, status: 401 });
    return { ok: false as const, response: fail('API key required', 401) };
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash: hashApiKey(key), active: true },
    select: { id: true, name: true, scopes: true },
  });
  if (!apiKey) {
    await recordApiUsage({ req, status: 401 });
    return { ok: false as const, response: fail('Invalid API key', 401) };
  }
  const scopes = fromJsonArray<string>((apiKey as any).scopes);
  if (requiredScope && !scopes.includes(requiredScope)) {
    await recordApiUsage({ apiKeyId: apiKey.id, req, status: 403 });
    return { ok: false as const, response: fail('API key scope is not allowed for this endpoint.', 403) };
  }

  return { ok: true as const, apiKey };
}
