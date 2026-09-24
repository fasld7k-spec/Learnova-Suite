import { prisma } from '@/lib/prisma';

export const systemFeatureFlags = [
  {
    key: 'checkout_disabled',
    label: 'Pause checkout',
    description: 'Blocks course, cart, bundle and subscription checkout flows while keeping browsing online.',
  },
  {
    key: 'registration_closed',
    label: 'Close public registration',
    description: 'Stops new public account creation even when registration is enabled in site settings.',
  },
  {
    key: 'instructor_registration_closed',
    label: 'Close instructor registration',
    description: 'Stops new instructor signups while student registration can remain open.',
  },
  {
    key: 'smart_assistant_disabled',
    label: 'Disable AI assistant',
    description: 'Turns off the public smart assistant instantly without changing provider settings.',
  },
  {
    key: 'public_demo_disabled',
    label: 'Hide public demo page',
    description: 'Returns 404 for /demo even when DEMO_MODE is enabled for hosted demos.',
  },
] as const;

export type SystemFeatureFlagKey = (typeof systemFeatureFlags)[number]['key'] | (string & {});

const cacheTtlMs = 30_000;
let cache: { expiresAt: number; values: Map<string, boolean> } | null = null;

function normalizeFeatureKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
}

async function loadFeatureFlags(force = false) {
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) return cache.values;

  const rows = await prisma.featureFlag.findMany({ select: { key: true, enabled: true } }).catch(() => []);
  const values = new Map(rows.map((row) => [normalizeFeatureKey(row.key), row.enabled]));
  cache = { expiresAt: now + cacheTtlMs, values };
  return values;
}

export function invalidateFeatureFlagCache() {
  cache = null;
}

export async function featureEnabled(key: SystemFeatureFlagKey) {
  const values = await loadFeatureFlags();
  return values.get(normalizeFeatureKey(key)) === true;
}

export async function anyFeatureEnabled(keys: SystemFeatureFlagKey[]) {
  const values = await loadFeatureFlags();
  return keys.some((key) => values.get(normalizeFeatureKey(key)) === true);
}

export async function requireFeatureAvailable(key: SystemFeatureFlagKey, message: string) {
  if (await featureEnabled(key)) throw new Error(message);
}
