/**
 * lib/2fa.ts
 * Two-Factor Authentication utilities for Learnova Suite.
 *
 * Provides TOTP generation/verification, backup code management,
 * and AES-256-CBC encryption for secrets at rest.
 *
 * Requirements: 8.1, 8.10, 8.11, 8.12
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTP_DIGITS = 6;
const TOTP_STEP = 30; // seconds per TOTP window
const TOTP_WINDOW = 1; // ±1 step tolerance (Requirement 8.12)
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 4; // 4 bytes → 8 hex chars
const BCRYPT_ROUNDS = 10;
const AES_ALGORITHM = "aes-256-cbc";
const IV_BYTES = 16;

// ---------------------------------------------------------------------------
// TOTP helpers (RFC 6238 / HOTP RFC 4226)
// ---------------------------------------------------------------------------

/**
 * Decode a base32-encoded string to a Buffer.
 * Supports the standard RFC 4648 base32 alphabet (A-Z, 2-7).
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Encode a Buffer as a base32 string (RFC 4648, no padding).
 */
function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

/**
 * Compute an HOTP value for the given key and counter (RFC 4226).
 */
function hotp(keyBuffer: Buffer, counter: bigint): number {
  // Pack counter as 8-byte big-endian
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  const hmac = createHmac("sha1", keyBuffer).update(counterBuf).digest();

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return code % Math.pow(10, TOTP_DIGITS);
}

/**
 * Compute the TOTP counter for a given Unix timestamp.
 */
function totpCounter(timestampSeconds: number): bigint {
  return BigInt(Math.floor(timestampSeconds / TOTP_STEP));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a new TOTP secret.
 * Returns a base32-encoded string suitable for use with authenticator apps.
 *
 * Requirement 8.1
 */
export function generateTOTPSecret(): string {
  // 20 bytes = 160 bits — standard TOTP secret length
  const secretBytes = randomBytes(20);
  return base32Encode(secretBytes);
}

/**
 * Verify a TOTP token against a base32-encoded secret.
 * Accepts tokens within a ±TOTP_WINDOW step window to handle clock drift.
 *
 * Requirement 8.12
 */
export function verifyTOTP(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  let keyBuffer: Buffer;
  try {
    keyBuffer = base32Decode(secret);
  } catch {
    return false;
  }

  const tokenNum = parseInt(token, 10);
  const now = Math.floor(Date.now() / 1000);
  const counter = totpCounter(now);

  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const expected = hotp(keyBuffer, counter + BigInt(delta));
    if (expected === tokenNum) return true;
  }

  return false;
}

/**
 * Generate exactly 10 random backup codes.
 * Each code is 8 uppercase hex characters (e.g. "A1B2C3D4").
 *
 * Requirement 8.1
 */
export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(BACKUP_CODE_BYTES).toString("hex").toUpperCase()
  );
}

// ---------------------------------------------------------------------------
// AES-256-CBC encryption for TOTP secrets at rest (Requirement 8.10)
// ---------------------------------------------------------------------------

/**
 * Retrieve and validate the 32-byte AES encryption key from the environment.
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.TOTP_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error("TOTP_ENCRYPTION_KEY environment variable is not set");
  }

  // Accept either a 64-char hex string (32 bytes) or a raw 32-char string
  if (keyEnv.length === 64 && /^[0-9a-fA-F]+$/.test(keyEnv)) {
    return Buffer.from(keyEnv, "hex");
  }

  const keyBuf = Buffer.from(keyEnv, "utf8");
  if (keyBuf.length !== 32) {
    throw new Error(
      `TOTP_ENCRYPTION_KEY must be exactly 32 bytes (got ${keyBuf.length}). ` +
        "Provide a 32-character UTF-8 string or a 64-character hex string."
    );
  }
  return keyBuf;
}

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * Returns the result as "iv:ciphertext" where both parts are hex-encoded.
 *
 * Requirement 8.10
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an "iv:ciphertext" hex string produced by `encryptSecret`.
 *
 * Requirement 8.10
 */
export function decryptSecret(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 2) {
    throw new Error(
      'Invalid encrypted format. Expected "iv:ciphertext" (hex-encoded).'
    );
  }

  const [ivHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_BYTES} bytes.`);
  }

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// Backup code hashing (Requirement 8.11)
// ---------------------------------------------------------------------------

/**
 * Hash a backup code using bcrypt (cost factor 10).
 * Store the returned hash in the database — never the plaintext code.
 *
 * Requirement 8.11
 */
export async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext backup code against a stored bcrypt hash.
 *
 * Requirement 8.11
 */
export async function verifyBackupCode(
  code: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
