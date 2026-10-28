type HeaderReader = Pick<Headers, 'get'>;

/**
 * Best-effort client IP for rate limiting and audit logs.
 *
 * The left-most X-Forwarded-For entry is supplied by the client and can be
 * spoofed, so it is never used. By default the right-most entry (added by the
 * nearest reverse proxy) is used. Behind a CDN, set CLIENT_IP_HEADER to the
 * header your edge overwrites, e.g. "cf-connecting-ip" or "x-real-ip".
 */
export function clientIp(headers: HeaderReader) {
  const trustedHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (trustedHeader) {
    const value = headers.get(trustedHeader)?.split(',')[0]?.trim();
    if (value) return value;
  }

  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (forwarded?.length) return forwarded[forwarded.length - 1];

  return headers.get('x-real-ip')?.trim() || 'local';
}
