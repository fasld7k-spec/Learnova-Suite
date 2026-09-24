import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from './errors';
import { requestRedirectUrl } from './redirect-url';

export function ok(data: unknown = {}, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

function publicErrorMessage(message: string, status: number) {
  if (status >= 500 && process.env.NODE_ENV === 'production') return 'Server error';
  return message;
}

function normalizedFailure(message: string, status: number) {
  if (message === 'UNAUTHENTICATED') return { message: 'Unauthenticated', status: 401 };
  if (message === 'FORBIDDEN') return { message: 'Forbidden', status: 403 };
  if (message === 'Course not found') return { message, status: 404 };
  return { message, status };
}

export function fail(message: string, status = 400, errors?: unknown) {
  const normalized = normalizedFailure(message, status);
  return NextResponse.json(
    { success: false, message: publicErrorMessage(normalized.message, normalized.status), errors },
    { status: normalized.status },
  );
}

function wantsHtml(req?: NextRequest) {
  const accept = req?.headers.get('accept') || '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

export function handleError(e: unknown) {
  const message = errorMessage(e);
  if (message === 'UNAUTHENTICATED') return fail('Unauthenticated', 401);
  if (message === 'FORBIDDEN') return fail('Forbidden', 403);
  if (message === 'Course not found') return fail('Course not found', 404);
  return fail(message, 500);
}

export function handleGatewayError(error: unknown) {
  const message = errorMessage(error);
  if (/not configured|required|missing/i.test(message)) return fail(message, 422);
  if (/stripe|paypal|gateway|provider/i.test(message)) return fail('Payment provider is unavailable.', 502);
  return handleError(error);
}

export function handleRouteError(e: unknown, req: NextRequest, fallback = '/login') {
  const message = errorMessage(e);
  if (message === 'UNAUTHENTICATED') {
    if (wantsHtml(req)) return NextResponse.redirect(requestRedirectUrl(req, fallback), 303);
    return fail('Unauthenticated', 401);
  }
  if (message === 'FORBIDDEN') return fail('Forbidden', 403);
  if (message === 'Course not found') return fail('Course not found', 404);
  return fail(message, 500);
}
