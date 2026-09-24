import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const prefix = 'enc:v1';

function key() {
  const source = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!source && process.env.NODE_ENV === 'production') {
    throw new Error('SETTINGS_ENCRYPTION_KEY is required in production.');
  }

  return createHash('sha256')
    .update(source || process.env.JWT_SECRET || 'dev-settings-encryption-key')
    .digest();
}

export function encryptSecret(value: string) {
  const plain = String(value || '');
  if (!plain || plain.startsWith(`${prefix}:`)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [prefix, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

export function decryptSecret(value: unknown) {
  const raw = String(value || '');
  if (!raw.startsWith(`${prefix}:`)) return raw;

  try {
    const [, , iv, tag, encrypted] = raw.split(':');
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
