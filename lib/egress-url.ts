import { lookup } from 'dns/promises';
import net from 'net';

type ServerUrlOptions = {
  label: string;
  allowedHosts?: string[];
  requireHttps?: boolean;
};

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    a === 100 && b >= 64 && b <= 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const value = address.toLowerCase();
  if (value.startsWith('::ffff:')) return isPrivateIpv4(value.slice('::ffff:'.length));
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local');
}

function isBlockedAddress(address: string) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return false;
}

function normalizedAllowedHosts(hosts?: string[]) {
  return new Set((hosts || []).map((host) => host.toLowerCase().trim()).filter(Boolean));
}

export function assertAllowedPayPalBaseUrl(value: string) {
  const parsed = new URL(value);
  const allowed = normalizedAllowedHosts(['api-m.paypal.com', 'api-m.sandbox.paypal.com']);
  if (parsed.protocol !== 'https:' || !allowed.has(parsed.hostname.toLowerCase()) || parsed.username || parsed.password) {
    throw new Error('PayPal API base URL must be the official PayPal live or sandbox endpoint.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export async function assertSafeServerUrl(value: string, options: ServerUrlOptions) {
  const raw = String(value || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${options.label} must be a valid URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${options.label} must use http or https.`);
  if ((options.requireHttps ?? process.env.NODE_ENV === 'production') && parsed.protocol !== 'https:') {
    throw new Error(`${options.label} must use HTTPS.`);
  }
  if (parsed.username || parsed.password) throw new Error(`${options.label} must not include credentials.`);

  const host = parsed.hostname.toLowerCase();
  const allowedHosts = normalizedAllowedHosts(options.allowedHosts);
  if (allowedHosts.size && !allowedHosts.has(host)) throw new Error(`${options.label} host is not allowed.`);
  if (isBlockedHostname(host) || isBlockedAddress(host)) throw new Error(`${options.label} cannot target private hosts.`);

  const records = await lookup(host, { all: true }).catch(() => []);
  if (records.some((record) => isBlockedAddress(record.address))) {
    throw new Error(`${options.label} cannot resolve to a private address.`);
  }

  return parsed.toString();
}
