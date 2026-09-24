/**
 * File upload validation: checks both the declared Content-Type / MIME type
 * and the file's magic bytes (file signature) to prevent MIME-type spoofing.
 *
 * Supported types:
 *   Images  – JPEG, PNG, GIF, WebP
 *   Videos  – MP4, WebM
 *   Docs    – PDF
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/** Default maximum allowed upload size: 100 MB */
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

/**
 * Magic-byte signatures for each supported MIME type.
 * Each entry contains one or more byte sequences that identify the format.
 */
const MAGIC_SIGNATURES: Record<string, Array<{ offset: number; bytes: number[] }>> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF header; WebP check below
  'video/mp4': [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp box
  ],
  'video/webm': [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }], // EBML header
  'application/pdf': [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'application/zip': [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK..
  'application/x-zip-compressed': [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
};

/** Allowed MIME types */
const ALLOWED_MIME_TYPES = new Set(Object.keys(MAGIC_SIGNATURES));

/**
 * Checks whether the given bytes match a magic-byte signature.
 */
function matchesSignature(
  buf: Uint8Array,
  sig: { offset: number; bytes: number[] },
): boolean {
  if (buf.length < sig.offset + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => buf[sig.offset + i] === b);
}

/**
 * Validates a file upload by checking:
 *  1. The declared MIME type is in the allow-list.
 *  2. The file's magic bytes match the declared MIME type.
 *
 * @param file        - A browser `File` object or a Node.js `Buffer`.
 * @param contentType - The MIME type declared by the client (Content-Type header).
 * @returns           - `{ valid: true }` or `{ valid: false, error: string }`.
 */
export async function validateFileUpload(
  file: File | Buffer,
  contentType: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<FileValidationResult> {
  // Normalise the MIME type (strip parameters like "; charset=utf-8")
  const mime = contentType.split(';')[0].trim().toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return { valid: false, error: `File type "${mime}" is not allowed.` };
  }

  // Read the first 12 bytes for magic-byte inspection
  let header: Uint8Array;
  if (Buffer.isBuffer(file)) {
    if (file.length > maxBytes) {
      return { valid: false, error: 'File exceeds the maximum allowed size.' };
    }
    header = new Uint8Array(file.buffer, file.byteOffset, Math.min(12, file.length));
  } else {
    const browserFile = file as File;
    if (browserFile.size > maxBytes) {
      return { valid: false, error: 'File exceeds the maximum allowed size.' };
    }
    const slice = browserFile.slice(0, 12);
    const arrayBuffer = await (slice as Blob).arrayBuffer();
    header = new Uint8Array(arrayBuffer);
  }

  const signatures = MAGIC_SIGNATURES[mime];
  const matched = signatures.some((sig) => matchesSignature(header, sig));

  if (!matched) {
    return {
      valid: false,
      error: `File content does not match the declared type "${mime}".`,
    };
  }

  // Extra check for WebP: bytes 8-11 must be "WEBP"
  if (mime === 'image/webp') {
    const webpMark = [0x57, 0x45, 0x42, 0x50]; // WEBP
    if (header.length < 12 || !webpMark.every((b, i) => header[8 + i] === b)) {
      return {
        valid: false,
        error: 'File content does not match the declared type "image/webp".',
      };
    }
  }

  return { valid: true };
}
