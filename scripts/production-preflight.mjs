import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];

function record(name, ok, details = '') {
  checks.push({ name, ok, details });
}

function loadEnvFile() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (process.env[key]) continue;
    process.env[key] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

function boolEnv(key) {
  return String(process.env[key] || '').toLowerCase() === 'true';
}

function unsafeSecret(value) {
  const raw = String(value || '').trim().toLowerCase();
  return !raw || raw.includes('demo-only') || raw.includes('demo-') || raw.includes('replace-with') || raw.includes('change-before-production');
}

function hasAny(...keys) {
  return keys.some((key) => String(process.env[key] || '').trim());
}

function allOrNone(...keys) {
  const present = keys.filter((key) => String(process.env[key] || '').trim());
  return present.length === 0 || present.length === keys.length;
}

loadEnvFile();

record('NODE_ENV=production', process.env.NODE_ENV === 'production', `current: ${process.env.NODE_ENV || 'unset'}`);
record('DATABASE_URL uses PostgreSQL', /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || ''), 'Use PostgreSQL for production.');
record('JWT_SECRET is strong', Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && !unsafeSecret(process.env.JWT_SECRET)), 'Use a long random secret.');
record('SETTINGS_ENCRYPTION_KEY set', !unsafeSecret(process.env.SETTINGS_ENCRYPTION_KEY), 'Required for encrypted admin/provider secrets.');
record('CONTENT_PROTECTION_SECRET set', !unsafeSecret(process.env.CONTENT_PROTECTION_SECRET), 'Required for signed protected media URLs.');
record('Demo mode disabled', !boolEnv('DEMO_MODE'), 'Set DEMO_MODE=false for live stores.');
record('Sandbox payments disabled', !boolEnv('PAYMENT_SANDBOX_MODE'), 'Set PAYMENT_SANDBOX_MODE=false for live stores.');
record('Production demo payments blocked', !boolEnv('ALLOW_PRODUCTION_DEMO_PAYMENTS'), 'Keep mock payments disabled on live stores.');
record('App URL configured or auto-detected', !process.env.NEXT_PUBLIC_APP_URL || /^https:\/\//i.test(process.env.NEXT_PUBLIC_APP_URL || ''), 'Optional: leave unset for request-domain auto-detection, or set a public HTTPS app URL.');
record('Remote storage configured', ['s3', 'r2'].includes(String(process.env.STORAGE_PROVIDER || '').toLowerCase()), 'Use S3/R2-compatible storage.');
record('Local uploads disabled', !boolEnv('ALLOW_LOCAL_UPLOADS'), 'Keep ALLOW_LOCAL_UPLOADS=false in production.');
record('Media host allowlist configured', Boolean(String(process.env.MEDIA_ALLOWED_HOSTS || '').trim()), 'Set CDN/video hostnames.');
record('SMTP configured', hasAny('SMTP_HOST') && hasAny('SMTP_FROM'), 'Set SMTP_HOST and SMTP_FROM for transactional email.');
record('Email provider is not demo', String(process.env.EMAIL_PROVIDER || '').toLowerCase() !== 'demo', 'Set EMAIL_PROVIDER=smtp or a live provider in production.');
record('At least one live payment key configured', hasAny('STRIPE_SECRET_KEY', 'PAYPAL_CLIENT_ID', 'PAYMOB_API_KEY', 'TAP_SECRET_KEY', 'RAZORPAY_KEY_ID'), 'Manual-only launches can mark this as intentional.');
record('PayPal webhook ID configured when PayPal is enabled', !hasAny('PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET') || hasAny('PAYPAL_WEBHOOK_ID'), 'Set PAYPAL_WEBHOOK_ID for official PayPal webhook verification.');
const bunnyEnabled = hasAny('BUNNY_API_KEY', 'BUNNY_LIBRARY_ID', 'BUNNY_CDN_HOSTNAME', 'BUNNY_TOKEN_AUTH_KEY', 'BUNNY_WEBHOOK_SECRET');
record('Bunny Stream config complete or disabled', allOrNone('BUNNY_API_KEY', 'BUNNY_LIBRARY_ID', 'BUNNY_CDN_HOSTNAME', 'BUNNY_TOKEN_AUTH_KEY', 'BUNNY_WEBHOOK_SECRET'), 'Set all Bunny vars together, including BUNNY_WEBHOOK_SECRET, or leave all empty to use S3/R2/local protected media.');
record('Bunny webhook secret is strong when Bunny is enabled', !bunnyEnabled || !unsafeSecret(process.env.BUNNY_WEBHOOK_SECRET), 'Set BUNNY_WEBHOOK_SECRET for signed Bunny processing callbacks.');

for (const check of checks) {
  console.log(`${check.ok ? 'OK' : 'REVIEW'} ${check.name}${check.details ? ` - ${check.details}` : ''}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`Production preflight found ${failed.length} item(s) to review.`);
  process.exit(1);
}

console.log('Production preflight passed.');
