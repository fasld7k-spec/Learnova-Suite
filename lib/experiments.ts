import { NextRequest } from 'next/server';

import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export type ExperimentVariant = {
  name?: string;
  label?: string;
  weight?: number;
};

export type ExperimentAssignment = {
  key: string;
  variant: string;
  variants: Array<{ name: string; weight: number }>;
};

const cacheTtlMs = 30_000;
let cache: { expiresAt: number; rows: Map<string, { variants: string; active: boolean }> } | null = null;

function normalizeExperimentKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeVariantName(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_.-]+/g, '');
}

function normalizeVariants(raw: string) {
  const parsed = fromJsonArray<ExperimentVariant>(raw)
    .map((variant) => ({
      name: normalizeVariantName(variant.name || variant.label),
      weight: Number(variant.weight ?? 0),
    }))
    .filter((variant) => variant.name);

  if (parsed.length < 2) return [];

  const hasWeights = parsed.some((variant) => variant.weight > 0);
  const fallbackWeight = Math.floor(100 / parsed.length);
  return parsed.map((variant) => ({
    name: variant.name,
    weight: hasWeights ? Math.max(0, variant.weight) : fallbackWeight,
  }));
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function loadExperiments(force = false) {
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) return cache.rows;
  const rows = await prisma.experiment.findMany({ select: { key: true, variants: true, active: true } }).catch(() => []);
  cache = {
    expiresAt: now + cacheTtlMs,
    rows: new Map(rows.map((row) => [normalizeExperimentKey(row.key), { variants: row.variants, active: row.active }])),
  };
  return cache.rows;
}

export function invalidateExperimentCache() {
  cache = null;
}

export async function getExperimentAssignment(key: string, seed: string): Promise<ExperimentAssignment | null> {
  const normalizedKey = normalizeExperimentKey(key);
  if (!normalizedKey || !seed) return null;

  const rows = await loadExperiments();
  const experiment = rows.get(normalizedKey);
  if (!experiment?.active) return null;

  const variants = normalizeVariants(experiment.variants);
  if (variants.length < 2) return null;

  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0) || variants.length;
  let bucket = hashSeed(`${normalizedKey}:${seed}`) % totalWeight;
  for (const variant of variants) {
    const weight = variant.weight || 1;
    if (bucket < weight) {
      return { key: normalizedKey, variant: variant.name, variants };
    }
    bucket -= weight;
  }

  return { key: normalizedKey, variant: variants[0].name, variants };
}

export function experimentSeedFromRequest(req: NextRequest, key: string) {
  const cookieName = experimentCookieName(key);
  return req.cookies.get(cookieName)?.value
    || req.cookies.get('session')?.value
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'anonymous';
}

export function experimentCookieName(key: string) {
  return `exp_${normalizeExperimentKey(key).slice(0, 40)}`;
}

export async function recordExperimentEvent(key: string, variant: string, event: string) {
  const safeKey = normalizeExperimentKey(key);
  const safeVariant = normalizeVariantName(variant);
  const safeEvent = normalizeExperimentKey(event || 'impression');
  if (!safeKey || !safeVariant) return;
  await prisma.systemMetricSnapshot.create({
    data: {
      key: `experiment.${safeKey}.${safeVariant}.${safeEvent}`,
      value: 1,
    },
  }).catch(() => null);
}
