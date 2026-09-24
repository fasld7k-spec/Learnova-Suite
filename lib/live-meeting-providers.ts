import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/secret-fields';

type LiveMeetingInput = {
  title: string;
  description?: string | null;
  startsAt: Date;
  durationMinutes: number;
  provider: string;
};

type LiveMeetingResult = {
  provider: string;
  joinUrl: string;
  externalId?: string;
};

function asString(value: unknown) {
  return String(value || '').trim();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + Math.max(1, minutes) * 60_000);
}

async function integrationConfig(provider: string) {
  const row = await prisma.integrationSetting.findUnique({ where: { provider } }).catch(() => null);
  if (!row?.active) return null;
  return fromJsonObject<Record<string, unknown>>(row.config);
}

function secret(config: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = decryptSecret(config[key]);
    if (value) return value;
  }
  return '';
}

async function createZoomMeeting(input: LiveMeetingInput): Promise<LiveMeetingResult | null> {
  const config = await integrationConfig('zoom');
  if (!config) return null;

  const accountId = asString(config.accountId);
  const clientId = asString(config.clientId);
  const clientSecret = secret(config, 'clientSecret', 'apiKey', 'secretKey');
  const userId = encodeURIComponent(asString(config.userId) || 'me');
  const timezone = asString(config.timezone) || 'UTC';
  if (!accountId || !clientId || !clientSecret) return null;

  const tokenResponse = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.reason || tokenData.message || 'Zoom OAuth token request failed.');
  }

  const meetingResponse = await fetch(`https://api.zoom.us/v2/users/${userId}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: input.title,
      type: 2,
      start_time: input.startsAt.toISOString(),
      duration: input.durationMinutes,
      timezone,
      agenda: input.description || input.title,
      settings: {
        join_before_host: false,
        waiting_room: true,
        approval_type: 2,
      },
    }),
  });
  const meetingData = await meetingResponse.json().catch(() => ({}));
  if (!meetingResponse.ok || !meetingData.join_url) {
    throw new Error(meetingData.message || 'Zoom meeting creation failed.');
  }

  return { provider: 'ZOOM', joinUrl: String(meetingData.join_url), externalId: String(meetingData.id || '') };
}

async function createGoogleMeetEvent(input: LiveMeetingInput): Promise<LiveMeetingResult | null> {
  const config = await integrationConfig('google_meet');
  if (!config) return null;

  const accessToken = await googleAccessToken(config);
  const calendarId = encodeURIComponent(asString(config.calendarId) || 'primary');
  const timezone = asString(config.timezone) || 'UTC';
  if (!accessToken) return null;

  const eventResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: input.title,
      description: input.description || '',
      start: { dateTime: input.startsAt.toISOString(), timeZone: timezone },
      end: { dateTime: addMinutes(input.startsAt, input.durationMinutes).toISOString(), timeZone: timezone },
      conferenceData: {
        createRequest: {
          requestId: `learnova-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  });
  const eventData = await eventResponse.json().catch(() => ({}));
  const entryUrl = Array.isArray(eventData.conferenceData?.entryPoints)
    ? eventData.conferenceData.entryPoints.find((entry: any) => entry.entryPointType === 'video')?.uri
    : null;
  const joinUrl = eventData.hangoutLink || entryUrl;
  if (!eventResponse.ok || !joinUrl) {
    throw new Error(eventData.error?.message || 'Google Meet event creation failed.');
  }

  return { provider: 'GOOGLE_MEET', joinUrl: String(joinUrl), externalId: String(eventData.id || '') };
}

async function googleAccessToken(config: Record<string, unknown>) {
  const refreshToken = secret(config, 'refreshToken');
  const clientId = asString(config.clientId);
  const clientSecret = secret(config, 'clientSecret');
  if (refreshToken && clientId && clientSecret) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Google OAuth refresh failed.');
    }
    return String(tokenData.access_token);
  }

  return secret(config, 'accessToken', 'apiKey', 'secretKey');
}

export async function createLiveMeeting(input: LiveMeetingInput): Promise<LiveMeetingResult | null> {
  const provider = input.provider.toUpperCase();
  if (provider === 'ZOOM') return createZoomMeeting(input);
  if (provider === 'GOOGLE_MEET') return createGoogleMeetEvent(input);
  return null;
}
