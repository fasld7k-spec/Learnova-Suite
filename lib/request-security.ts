import { NextRequest } from 'next/server';
import { fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

type RateLimitPolicy = { limit: number; windowMs: number };

const RATE_LIMIT_POLICY_TTL_MS = 30_000;
let policyCache = new Map<string, RateLimitPolicy>();
let policyLoadedAt = 0;
let policyLoading: Promise<void> | null = null;

function normalizePolicyKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_.:-]+/g, '.').replace(/^\.+|\.+$/g, '');
}

function policyFor(key: string, fallbackLimit: number, fallbackWindowMs: number) {
  const normalized = normalizePolicyKey(key);
  const exact = policyCache.get(normalized);
  if (exact) return exact;

  let candidate = normalized;
  while (candidate.includes(':')) {
    candidate = candidate.slice(0, candidate.lastIndexOf(':'));
    const policy = policyCache.get(candidate);
    if (policy) return policy;
  }

  return { limit: fallbackLimit, windowMs: fallbackWindowMs };
}

export async function refreshRateLimitPolicies(force = false) {
  const now = Date.now();
  if (!force && now - policyLoadedAt < RATE_LIMIT_POLICY_TTL_MS) return;
  if (policyLoading) return policyLoading;

  policyLoading = prisma.rateLimitRule
    .findMany({ where: { active: true }, select: { key: true, limit: true, windowSec: true } })
    .then((rules) => {
      policyCache = new Map(
        rules.map((rule) => [
          normalizePolicyKey(rule.key),
          { limit: rule.limit, windowMs: rule.windowSec * 1000 },
        ])
      );
      policyLoadedAt = Date.now();
    })
    .catch((error) => {
      policyLoadedAt = Date.now();
      console.warn('Rate limit policy refresh failed', error);
    })
    .finally(() => {
      policyLoading = null;
    });

  return policyLoading;
}

function refreshRateLimitPoliciesInBackground() {
  void refreshRateLimitPolicies().catch(() => undefined);
}

export function requestIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  );
}

function requestHost(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host') ||
    req.nextUrl.host
  ).toLowerCase();
}

function originHost(value: string | null) {
  if (!value) return '';
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return '';
  }
}

export function enforceSameOrigin(req: NextRequest) {
  const sourceHost = originHost(req.headers.get('origin')) || originHost(req.headers.get('referer'));
  if (!sourceHost) return null;
  if (sourceHost !== requestHost(req)) return fail('Cross-origin request blocked.', 403);
  return null;
}

export function enforceRateLimit(
  req: NextRequest,
  key: string,
  limit = 20,
  windowMs = 60_000
) {
  refreshRateLimitPoliciesInBackground();
  const policy = policyFor(key, limit, windowMs);
  const limited = rateLimit(`${key}:${requestIp(req)}`, policy.limit, policy.windowMs);
  if (!limited.ok) return fail('Too many requests. Try again shortly.', 429);
  return null;
}
