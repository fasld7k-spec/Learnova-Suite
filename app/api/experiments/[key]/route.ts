import { NextRequest, NextResponse } from 'next/server';

import { fail, ok } from '@/lib/api';
import {
  experimentCookieName,
  experimentSeedFromRequest,
  getExperimentAssignment,
  recordExperimentEvent,
} from '@/lib/experiments';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const limited = enforceRateLimit(req, `experiment:${key}`, 120, 60_000);
  if (limited) return limited;

  const url = new URL(req.url);
  const seed = url.searchParams.get('seed') || experimentSeedFromRequest(req, key);
  const assignment = await getExperimentAssignment(key, seed);
  if (!assignment) return ok({ active: false, key, variant: null, variants: [] });

  await recordExperimentEvent(assignment.key, assignment.variant, 'impression');
  const response = ok({ active: true, ...assignment });
  response.cookies.set(experimentCookieName(assignment.key), seed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const originBlocked = enforceSameOrigin(req);
  if (originBlocked) return originBlocked;
  const limited = enforceRateLimit(req, `experiment.event:${key}`, 60, 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const variant = String(body?.variant || '').trim();
  const event = String(body?.event || 'conversion').trim();
  if (!variant) return fail('Variant is required.', 422);

  await recordExperimentEvent(key, variant, event);
  return NextResponse.json({ success: true, data: { recorded: true } });
}
