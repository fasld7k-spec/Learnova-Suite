import { createHash, createHmac, randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { getSiteSettings } from '@/lib/site-settings';
import { validateFileUpload } from '@/lib/file-validation';

type SaveFileOptions = {
  directory?: string;
  allowedTypes: string[];
  maxBytes: number;
  purpose: string;
};

type StoredFile = {
  key: string;
  name: string;
  url: string;
};

const extensionByType: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'video/mp4': '.mp4'
};

function cleanDirectory(directory?: string) {
  return (directory || '').split('/').map((part) => part.replace(/[^a-zA-Z0-9-_]/g, '')).filter(Boolean).join('/');
}

function safeExtension(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  if (Object.values(extensionByType).includes(ext)) return ext;
  return extensionByType[file.type] || '';
}

type StorageSettings = Awaited<ReturnType<typeof getSiteSettings>>;

function s3Config(settings: StorageSettings) {
  const bucket = settings.storageBucket;
  const accessKeyId = settings.storageAccessKeyId;
  const secretAccessKey = settings.storageSecretAccessKey;
  const region = settings.storageRegion || 'auto';

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3/R2 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
  }

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint: settings.storageEndpoint?.replace(/\/$/, '') || `https://${bucket}.s3.${region}.amazonaws.com`,
    publicBaseUrl: settings.storagePublicBaseUrl?.replace(/\/$/, '')
  };
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function amzTimestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function dateStamp(date: Date) {
  return amzTimestamp(date).slice(0, 8);
}

function canonicalPath(rawPath: string) {
  return rawPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function s3ObjectUrl(key: string, config: ReturnType<typeof s3Config>) {
  const endpoint = new URL(config.endpoint);
  const endpointLooksAwsBucket = endpoint.hostname.startsWith(`${config.bucket}.`);
  const objectPath = endpointLooksAwsBucket ? `/${key}` : `/${config.bucket}/${key}`;
  return new URL(canonicalPath(objectPath), endpoint).toString();
}

async function putS3Object(key: string, bytes: Buffer, contentType: string, config: ReturnType<typeof s3Config>) {
  const url = new URL(s3ObjectUrl(key, config));
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const shortDate = dateStamp(now);
  const payloadHash = createHash('sha256').update(bytes).digest('hex');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    ''
  ].join('\n');
  const credentialScope = `${shortDate}/${config.region}/s3/aws4_request`;
  const canonicalRequest = ['PUT', canonicalPath(url.pathname), '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, shortDate), config.region), 's3'), 'aws4_request');
  const signature = hmacHex(signingKey, stringToSign);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    },
    body: bytes as unknown as BodyInit
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Storage upload failed (${response.status}). ${message}`.trim());
  }
}

async function deleteS3Object(key: string, config: ReturnType<typeof s3Config>) {
  const url = new URL(s3ObjectUrl(key, config));
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const shortDate = dateStamp(now);
  const payloadHash = createHash('sha256').update('').digest('hex');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = [`host:${url.host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amzDate}`, ''].join('\n');
  const credentialScope = `${shortDate}/${config.region}/s3/aws4_request`;
  const canonicalRequest = ['DELETE', canonicalPath(url.pathname), '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, shortDate), config.region), 's3'), 'aws4_request');
  const signature = hmacHex(signingKey, stringToSign);

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    },
  });
  if (!response.ok && response.status !== 404) {
    const message = await response.text().catch(() => '');
    throw new Error(`Storage delete failed (${response.status}). ${message}`.trim());
  }
}

function s3GetHeaders(url: URL, config: ReturnType<typeof s3Config>) {
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const shortDate = dateStamp(now);
  const payloadHash = createHash('sha256').update('').digest('hex');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = [`host:${url.host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amzDate}`, ''].join('\n');
  const credentialScope = `${shortDate}/${config.region}/s3/aws4_request`;
  const canonicalRequest = ['GET', canonicalPath(url.pathname), '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, shortDate), config.region), 's3'), 'aws4_request');
  const signature = hmacHex(signingKey, stringToSign);

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
}

function objectKeyFromStoredUrl(value: string, config: ReturnType<typeof s3Config>) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/^\/+/, '').replace(/\\/g, '/');
  if (normalized.startsWith('uploads/') || normalized.startsWith('protected-uploads/')) return normalized;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }

  const publicBaseUrl = config.publicBaseUrl;
  if (publicBaseUrl && raw.startsWith(`${publicBaseUrl}/`)) {
    return decodeURIComponent(raw.slice(publicBaseUrl.length + 1)).replace(/^\/+/, '');
  }

  const endpoint = new URL(config.endpoint);
  if (parsed.host !== endpoint.host) return '';
  const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  const bucketPrefix = `${config.bucket}/`;
  return pathname.startsWith(bucketPrefix) ? pathname.slice(bucketPrefix.length) : pathname;
}

export async function fetchProtectedStoredFile(url: string, requestHeaders?: { range?: string | null; accept?: string | null }) {
  const settings = await getSiteSettings();
  const activeProvider = (settings.storageProvider || 'local').toLowerCase();
  if (activeProvider !== 's3' && activeProvider !== 'r2') return null;

  const config = s3Config(settings);
  const key = objectKeyFromStoredUrl(url, config);
  if (!key.startsWith('protected-uploads/')) return null;

  const objectUrl = new URL(s3ObjectUrl(key, config));
  return fetch(objectUrl, {
    headers: {
      ...s3GetHeaders(objectUrl, config),
      ...(requestHeaders?.range ? { Range: requestHeaders.range } : {}),
      ...(requestHeaders?.accept ? { Accept: requestHeaders.accept } : {})
    },
    cache: 'no-store',
    redirect: 'manual'
  });
}

export async function deleteStoredFile(key: string) {
  const settings = await getSiteSettings();
  const activeProvider = (settings.storageProvider || 'local').toLowerCase();
  const safeKey = key.replace(/^\/+/, '').replace(/\\/g, '/');

  function assertWithin(root: string, relative: string) {
    const resolvedRoot = path.resolve(root);
    const target = path.resolve(resolvedRoot, relative);
    if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error('Refusing to delete a storage key outside uploads directories.');
    }
    return target;
  }

  if (activeProvider === 'local') {
    if (safeKey.startsWith('protected-uploads/')) {
      const relative = safeKey.replace(/^protected-uploads\/?/, '');
      await rm(assertWithin(path.join(process.cwd(), 'storage', 'protected-uploads'), relative), { force: true });
      return;
    }
    if (safeKey.startsWith('uploads/')) {
      const relative = safeKey.replace(/^uploads\/?/, '');
      await rm(assertWithin(path.join(process.cwd(), 'public', 'uploads'), relative), { force: true });
      return;
    }
    throw new Error('Refusing to delete a storage key outside uploads directories.');
  }

  if (activeProvider !== 's3' && activeProvider !== 'r2') {
    throw new Error(`Unsupported storage provider "${activeProvider}". Use local, s3, or r2.`);
  }

  await deleteS3Object(safeKey, s3Config(settings));
}

export async function saveFileToStorage(file: File | null, options: SaveFileOptions): Promise<StoredFile | null> {
  if (!file || file.size === 0) return null;
  if (!options.allowedTypes.includes(file.type)) throw new Error(`${options.purpose} has an unsupported file type.`);
  if (file.size > options.maxBytes) throw new Error(`${options.purpose} is too large.`);

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = await validateFileUpload(bytes, file.type, options.maxBytes);
  if (!validation.valid) throw new Error(`${options.purpose} failed file validation. ${validation.error || ''}`.trim());

  const fileName = `${randomUUID()}${safeExtension(file)}`;
  const directory = cleanDirectory(options.directory);
  const relativeKey = directory ? `${directory}/${fileName}` : fileName;
  const key = `uploads/${relativeKey}`;
  const settings = await getSiteSettings();
  const activeProvider = (settings.storageProvider || 'local').toLowerCase();

  if (activeProvider === 'local') {
    if (process.env.NODE_ENV === 'production' && !settings.allowLocalUploads) {
      throw new Error('Local uploads are disabled in production. Configure S3/R2 storage or set ALLOW_LOCAL_UPLOADS=true intentionally.');
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', directory);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), bytes);
    return { key, name: fileName, url: `/uploads/${relativeKey}` };
  }

  if (activeProvider !== 's3' && activeProvider !== 'r2') {
    throw new Error(`Unsupported storage provider "${activeProvider}". Use local, s3, or r2.`);
  }

  const config = s3Config(settings);
  await putS3Object(key, bytes, file.type, config);
  const baseUrl = config.publicBaseUrl;
  return { key, name: fileName, url: baseUrl ? `${baseUrl}/${key}` : s3ObjectUrl(key, config) };
}

export async function saveProtectedFileToStorage(file: File | null, options: SaveFileOptions): Promise<StoredFile | null> {
  if (!file || file.size === 0) return null;
  if (!options.allowedTypes.includes(file.type)) throw new Error(`${options.purpose} has an unsupported file type.`);
  if (file.size > options.maxBytes) throw new Error(`${options.purpose} is too large.`);

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = await validateFileUpload(bytes, file.type, options.maxBytes);
  if (!validation.valid) throw new Error(`${options.purpose} failed file validation. ${validation.error || ''}`.trim());

  const fileName = `${randomUUID()}${safeExtension(file)}`;
  const directory = cleanDirectory(options.directory);
  const relativeKey = directory ? `${directory}/${fileName}` : fileName;
  const key = `protected-uploads/${relativeKey}`;
  const settings = await getSiteSettings();
  const activeProvider = (settings.storageProvider || 'local').toLowerCase();

  if (activeProvider === 'local') {
    if (process.env.NODE_ENV === 'production' && !settings.allowLocalUploads) {
      throw new Error('Local protected uploads are disabled in production. Configure S3/R2 storage or explicitly allow local uploads.');
    }

    const uploadDir = path.join(process.cwd(), 'storage', 'protected-uploads', directory);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), bytes);
    return { key, name: fileName, url: `/protected-uploads/${relativeKey}` };
  }

  if (activeProvider !== 's3' && activeProvider !== 'r2') {
    throw new Error(`Unsupported storage provider "${activeProvider}". Use local, s3, or r2.`);
  }

  const config = s3Config(settings);
  await putS3Object(key, bytes, file.type, config);
  const baseUrl = config.publicBaseUrl;
  return { key, name: fileName, url: baseUrl ? `${baseUrl}/${key}` : s3ObjectUrl(key, config) };
}
