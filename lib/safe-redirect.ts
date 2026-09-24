export function safeRedirectPath(value: unknown, fallback = '/') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  try {
    const parsed = new URL(raw, 'https://learnova.local');
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
