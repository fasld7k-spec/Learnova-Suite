type UrlValidationOptions = {
  label: string;
  allowRelative?: boolean;
  requireHttpsInProduction?: boolean;
};

export function validateStoredUrl(value: string | null | undefined, options: UrlValidationOptions) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (options.allowRelative && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${options.label} must be a valid URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${options.label} must use http or https.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${options.label} must not include credentials.`);
  }
  if (options.requireHttpsInProduction !== false && process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error(`${options.label} must use HTTPS in production.`);
  }

  return parsed.toString();
}
