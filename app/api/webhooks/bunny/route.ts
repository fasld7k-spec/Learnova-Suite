import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/webhooks/bunny
 *
 * Bunny.net video processing webhook.
 *
 * Bunny.net sends a POST request when a video's encoding status changes.
 * Relevant status codes:
 *   0 = Created
 *   1 = Uploaded
 *   2 = Processing
 *   3 = Finished (encoding complete / ready)
 *   4 = Failed
 *
 * When Status === 3 (encoding finished), update the VideoAsset to READY
 * and store the HLS URL and duration (req 5.4).
 */
function timingSafeStringEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function verifyBunnyWebhook(req: NextRequest, rawBody: string) {
  const secret = process.env.BUNNY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
  if (!secret) return process.env.NODE_ENV !== 'production';

  const sharedSecret = req.headers.get('x-bunny-webhook-secret') || req.headers.get('x-webhook-secret') || '';
  if (sharedSecret && timingSafeStringEqual(sharedSecret, secret)) return true;

  const signature = (req.headers.get('x-bunny-signature') || req.headers.get('x-learnova-signature') || '')
    .replace(/^sha256=/i, '')
    .trim();
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeStringEqual(signature, expected);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyBunnyWebhook(req, rawBody)) {
      return NextResponse.json({ error: 'Invalid Bunny webhook signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    const { VideoLibraryId, VideoGuid, Status, Duration } = payload as {
      VideoLibraryId?: string | number;
      VideoGuid?: string;
      Status?: number;
      Duration?: number;
    };
    if (process.env.BUNNY_LIBRARY_ID && String(VideoLibraryId || '') !== process.env.BUNNY_LIBRARY_ID) {
      return NextResponse.json({ error: 'Invalid Bunny library' }, { status: 403 });
    }

    // Status 3 = encoding finished / ready (req 5.4)
    if (Status === 3 && VideoGuid) {
      const cdnHostname = process.env.BUNNY_CDN_HOSTNAME ?? '';

      // HLS URL format: https://{BUNNY_CDN_HOSTNAME}/{VideoGuid}/playlist.m3u8
      const hlsUrl = cdnHostname
        ? `https://${cdnHostname}/${VideoGuid}/playlist.m3u8`
        : `https://vz-${VideoLibraryId ?? ''}.b-cdn.net/${VideoGuid}/playlist.m3u8`;

      // Duration from Bunny.net is in seconds
      const duration = typeof Duration === 'number' ? Duration : null;

      await prisma.videoAsset.updateMany({
        where: { externalId: VideoGuid },
        data: {
          status: 'READY',
          hlsUrl,
          ...(duration !== null ? { duration } : {}),
        },
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    // Always return 200 to prevent Bunny.net from retrying on parse errors
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
