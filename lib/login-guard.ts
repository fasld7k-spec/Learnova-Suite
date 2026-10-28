import { isRateLimited, rateLimit, resetRateLimit } from '@/lib/rate-limit';

/** Max failed password or TOTP attempts per user before a temporary lockout (Req 11.6). */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
/** Lockout window: 15 minutes (Req 11.6). */
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

function key(userId: string) {
  return `auth.login.user:${userId}`;
}

/** True while the user is locked out; checked before any credential is verified. */
export function isLoginLocked(userId: string) {
  return isRateLimited(key(userId), MAX_FAILED_LOGIN_ATTEMPTS);
}

/** Records a failed password or TOTP attempt. Returns true when this failure triggers the lockout. */
export function recordLoginFailure(userId: string) {
  return !rateLimit(key(userId), MAX_FAILED_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_MS).ok;
}

/** Clears the counter after a fully successful login (password and, when enabled, TOTP). */
export function clearLoginFailures(userId: string) {
  resetRateLimit(key(userId));
}
