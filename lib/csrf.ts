import { cookies } from 'next/headers';

/**
 * Reads the CSRF token from the cookie.
 * The token is set by middleware on every request.
 * Returns empty string if not present (safe — verifyCsrf will return false).
 */
export async function getCsrfToken(): Promise<string> {
  return (await cookies()).get('csrf_token')?.value ?? '';
}

export async function verifyCsrf(formToken: string | null): Promise<boolean> {
  const cookie = (await cookies()).get('csrf_token')?.value;
  return !!cookie && !!formToken && cookie === formToken;
}

/** Generates a new CSRF token string (used by middleware). */
export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

