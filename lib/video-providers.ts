import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BunnyVideoConfig {
  embedUrl: string;
  thumbnailUrl: string;
}

// ---------------------------------------------------------------------------
// uploadToBunny
// ---------------------------------------------------------------------------

/**
 * Uploads a file to the configured Bunny.net Stream library.
 *
 * Steps:
 *  1. POST to create a new video entry and obtain a videoId.
 *  2. PUT the raw file bytes to upload the actual video content.
 *
 * @param file     The video file to upload (File or Buffer).
 * @param fileName The desired file name (used as the video title on Bunny.net).
 * @returns        The Bunny.net `videoId` assigned to the uploaded video.
 */
export async function uploadToBunny(
  file: File | Buffer,
  fileName: string
): Promise<string> {
  const apiKey = requireEnv('BUNNY_API_KEY');
  const libraryId = requireEnv('BUNNY_LIBRARY_ID');

  const baseUrl = `https://video.bunnycdn.com/library/${libraryId}/videos`;

  // Step 1: Create a video entry to obtain a videoId.
  const createResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: fileName }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text().catch(() => '');
    throw new Error(
      `Bunny.net video creation failed (${createResponse.status}): ${errorText}`.trim()
    );
  }

  const createData = (await createResponse.json()) as { guid?: string };
  const videoId = createData.guid;

  if (!videoId) {
    throw new Error('Bunny.net video creation response did not include a guid/videoId.');
  }

  // Step 2: Upload the file bytes.
  const fileBytes =
    Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());

  const uploadResponse = await fetch(`${baseUrl}/${videoId}`, {
    method: 'PUT',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBytes as unknown as BodyInit,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '');
    throw new Error(
      `Bunny.net video upload failed (${uploadResponse.status}): ${errorText}`.trim()
    );
  }

  return videoId;
}

// ---------------------------------------------------------------------------
// getBunnyVideoConfig
// ---------------------------------------------------------------------------

/**
 * Constructs the embed URL and thumbnail URL for a Bunny.net video.
 *
 * - embedUrl:     `https://iframe.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{videoId}`
 * - thumbnailUrl: `https://{BUNNY_CDN_HOSTNAME}/{videoId}/thumbnail.jpg`
 *
 * @param videoId The Bunny.net video GUID.
 * @returns       An object containing `embedUrl` and `thumbnailUrl`.
 */
export function getBunnyVideoConfig(videoId: string): BunnyVideoConfig {
  const libraryId = requireEnv('BUNNY_LIBRARY_ID');
  const cdnHostname = requireEnv('BUNNY_CDN_HOSTNAME');

  return {
    embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`,
    thumbnailUrl: `https://${cdnHostname}/${videoId}/thumbnail.jpg`,
  };
}

// ---------------------------------------------------------------------------
// generateSignedEmbedUrl
// ---------------------------------------------------------------------------

/**
 * Generates a signed embed URL for a Bunny.net video that expires after
 * `expiresIn` seconds from the current time.
 *
 * Token algorithm:
 *   HMAC-SHA256( BUNNY_TOKEN_AUTH_KEY + videoId + expiresTimestamp )
 *   using BUNNY_TOKEN_AUTH_KEY as the HMAC key.
 *
 * Signed URL format:
 *   `https://iframe.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{videoId}?token={token}&expires={expiresTimestamp}`
 *
 * @param videoId   The Bunny.net video GUID.
 * @param expiresIn Seconds until the URL expires (default: 3600).
 * @returns         The signed embed URL string.
 */
export function generateSignedEmbedUrl(
  videoId: string,
  expiresIn: number = 3600
): string {
  const libraryId = requireEnv('BUNNY_LIBRARY_ID');
  const tokenAuthKey = requireEnv('BUNNY_TOKEN_AUTH_KEY');

  const expiresTimestamp = Math.floor(Date.now() / 1000) + expiresIn;

  // The message to sign is the concatenation of key + videoId + expiry.
  const message = `${tokenAuthKey}${videoId}${expiresTimestamp}`;

  const token = createHmac('sha256', tokenAuthKey)
    .update(message)
    .digest('hex');

  const baseUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  return `${baseUrl}?token=${token}&expires=${expiresTimestamp}`;
}
