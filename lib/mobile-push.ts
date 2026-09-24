import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { prisma } from '@/lib/prisma';

type PushDataValue = string | number | boolean | null | undefined;

export type MobilePushPayload = {
  title: string;
  body: string;
  data?: Record<string, PushDataValue>;
};

export type MobilePushResult = {
  enabled: boolean;
  sent: number;
  failed: number;
  cleaned: number;
  reason?: string;
};

const FIREBASE_APP_NAME = 'learnova-mobile-push';
const FIREBASE_MESSAGING_PROVIDER = 'firebase_messaging';
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

let cachedApp: App | null | undefined;
let cachedDisabledReason: string | undefined;

function serviceAccountFromEnv() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    let parsed: {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };

    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch {
      return null;
    }

    return {
      projectId: parsed.project_id ?? parsed.projectId,
      clientEmail: parsed.client_email ?? parsed.clientEmail,
      privateKey: (parsed.private_key ?? parsed.privateKey)?.replace(/\\n/g, '\n'),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  return { projectId, clientEmail, privateKey };
}

function firebaseApp() {
  if (cachedApp !== undefined) return cachedApp;

  try {
    const credentials = serviceAccountFromEnv();
    if (!credentials?.projectId || !credentials.clientEmail || !credentials.privateKey) {
      cachedDisabledReason = 'Firebase Admin credentials are not configured.';
      cachedApp = null;
      return cachedApp;
    }

    cachedApp =
      getApps().find((app) => app.name === FIREBASE_APP_NAME) ??
      initializeApp({ credential: cert(credentials) }, FIREBASE_APP_NAME);
    cachedDisabledReason = undefined;
    return cachedApp;
  } catch {
    try {
      cachedApp = getApp(FIREBASE_APP_NAME);
      cachedDisabledReason = undefined;
      return cachedApp;
    } catch {
      cachedDisabledReason = 'Firebase Admin could not be initialized.';
      cachedApp = null;
      return cachedApp;
    }
  }
}

function stringData(data: MobilePushPayload['data']) {
  if (!data) return undefined;

  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function cleanText(value: string, fallback: string) {
  return value.trim().slice(0, 240) || fallback;
}

function isInvalidTokenError(code: string | undefined) {
  return Boolean(code && INVALID_TOKEN_CODES.has(code));
}

function isDeviceProviderColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'P2022') return true;
  return /provider/i.test(error.message) && /column|does not exist|no such column|unknown|not found/i.test(error.message);
}

async function compatibilityDeviceTokensForUser(userId: string) {
  return prisma.userDevice.findMany({
    where: {
      userId,
      token: { not: null },
    },
    select: { token: true },
    orderBy: { lastSeen: 'desc' },
    take: 500,
  });
}

async function firebaseDeviceTokensForUser(userId: string) {
  let devices: { token: string | null }[];

  try {
    devices = await prisma.userDevice.findMany({
      where: {
        userId,
        provider: FIREBASE_MESSAGING_PROVIDER,
        token: { not: null },
      },
      select: { token: true },
      orderBy: { lastSeen: 'desc' },
      take: 500,
    });
  } catch (error) {
    if (!isDeviceProviderColumnError(error)) throw error;
    devices = await compatibilityDeviceTokensForUser(userId);
  }

  return [
    ...new Set(
      devices.map((device) => device.token?.trim()).filter((token): token is string => Boolean(token)),
    ),
  ];
}

async function cleanInvalidFirebaseTokens(userId: string, tokens: string[]) {
  if (!tokens.length) return 0;

  const result = await prisma.userDevice.deleteMany({
    where: {
      userId,
      token: { in: tokens },
    },
  });

  return result.count;
}

export async function sendMobilePushToUser(
  userId: string,
  payload: MobilePushPayload,
): Promise<MobilePushResult> {
  const app = firebaseApp();
  if (!app) {
    return {
      enabled: false,
      sent: 0,
      failed: 0,
      cleaned: 0,
      reason: cachedDisabledReason,
    };
  }

  const tokens = await firebaseDeviceTokensForUser(userId);
  if (!tokens.length) {
    return {
      enabled: true,
      sent: 0,
      failed: 0,
      cleaned: 0,
      reason: 'No Firebase Messaging device tokens were found for this user.',
    };
  }

  const message: MulticastMessage = {
    tokens,
    notification: {
      title: cleanText(payload.title, 'Learnova'),
      body: cleanText(payload.body, 'You have a new update.'),
    },
  };
  const data = stringData(payload.data);
  if (data) message.data = data;

  const response = await getMessaging(app).sendEachForMulticast(message).catch(() => null);
  if (!response) {
    return {
      enabled: true,
      sent: 0,
      failed: tokens.length,
      cleaned: 0,
      reason: 'Firebase Messaging send failed.',
    };
  }

  const invalidTokens = response.responses
    .map((result, index) => (result.success ? null : { token: tokens[index], code: result.error?.code }))
    .filter((entry): entry is { token: string; code: string | undefined } =>
      Boolean(entry?.token && isInvalidTokenError(entry.code)),
    )
    .map((entry) => entry.token);

  const cleaned = await cleanInvalidFirebaseTokens(userId, invalidTokens);

  return {
    enabled: true,
    sent: response.successCount,
    failed: response.failureCount,
    cleaned,
  };
}
