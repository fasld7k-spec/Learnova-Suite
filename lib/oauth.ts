import { randomBytes } from 'crypto';
import { resolveAppUrl } from '@/lib/app-url';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export type OAuthProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireConfigValue(name: string, value?: string): string {
  if (!value) throw new Error(`Missing required OAuth configuration: ${name}`);
  return value;
}

function getRedirectUri(provider: 'google' | 'github' | 'facebook', baseUrl?: string, config?: OAuthProviderConfig): string {
  if (config?.redirectUri) return config.redirectUri;
  const appUrl = resolveAppUrl({ configured: baseUrl });
  return `${appUrl}/api/auth/oauth/${provider}/callback`;
}

// ─── State Generation ─────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random state parameter (hex string)
 * for use as the OAuth `state` parameter to prevent CSRF attacks.
 */
export function generateState(): string {
  return randomBytes(32).toString('hex');
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * Builds the Google OAuth 2.0 authorization URL.
 * Scopes: openid, email, profile
 */
export function buildGoogleAuthUrl(state: string, baseUrl?: string, config?: OAuthProviderConfig): string {
  const clientId = requireConfigValue('GOOGLE_CLIENT_ID', config?.clientId || process.env.GOOGLE_CLIENT_ID);
  const redirectUri = getRedirectUri('google', baseUrl, config);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges a Google authorization code for access/refresh tokens.
 */
export async function exchangeGoogleCode(code: string, baseUrl?: string, config?: OAuthProviderConfig): Promise<OAuthTokens> {
  const clientId = requireConfigValue('GOOGLE_CLIENT_ID', config?.clientId || process.env.GOOGLE_CLIENT_ID);
  const clientSecret = requireConfigValue('GOOGLE_CLIENT_SECRET', config?.clientSecret || process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = getRedirectUri('google', baseUrl, config);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google token exchange failed (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
  };

  if (!data.access_token) {
    throw new Error('Google token exchange returned no access_token');
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : undefined;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Fetches the authenticated user's profile from Google's userinfo endpoint.
 */
export async function fetchGoogleProfile(
  accessToken: string
): Promise<OAuthProfile> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to fetch Google profile (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
    email_verified?: boolean;
  };

  if (!data.sub || !data.email) {
    throw new Error('Google profile response is missing required fields (sub, email)');
  }
  if (data.email_verified !== true) {
    throw new Error('Google profile email is not verified');
  }

  return {
    id: data.sub,
    email: data.email,
    name: data.name ?? data.email,
    avatar: data.picture,
  };
}

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

/**
 * Builds the GitHub OAuth authorization URL.
 * Scopes: read:user, user:email
 */
export function buildGithubAuthUrl(state: string, baseUrl?: string, config?: OAuthProviderConfig): string {
  const clientId = requireConfigValue('GITHUB_CLIENT_ID', config?.clientId || process.env.GITHUB_CLIENT_ID);
  const redirectUri = getRedirectUri('github', baseUrl, config);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges a GitHub authorization code for an access token.
 */
export async function exchangeGithubCode(
  code: string,
  baseUrl?: string,
  config?: OAuthProviderConfig
): Promise<{ accessToken: string }> {
  const clientId = requireConfigValue('GITHUB_CLIENT_ID', config?.clientId || process.env.GITHUB_CLIENT_ID);
  const clientSecret = requireConfigValue('GITHUB_CLIENT_SECRET', config?.clientSecret || process.env.GITHUB_CLIENT_SECRET);
  const redirectUri = getRedirectUri('github', baseUrl, config);

  const response = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub token exchange failed (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      `GitHub token exchange error: ${data.error_description ?? data.error ?? 'no access_token returned'}`
    );
  }

  return { accessToken: data.access_token };
}

/**
 * Fetches the authenticated user's profile from the GitHub API.
 * Calls /user for basic info and /user/emails to get the primary verified email
 * (GitHub may not expose email in /user if the user has set it private).
 */
export async function fetchGithubProfile(
  accessToken: string
): Promise<OAuthProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
  };

  // Fetch basic user info
  const userResponse = await fetch('https://api.github.com/user', { headers });

  if (!userResponse.ok) {
    const errorBody = await userResponse.text();
    throw new Error(
      `Failed to fetch GitHub user (${userResponse.status}): ${errorBody}`
    );
  }

  const userData = (await userResponse.json()) as {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url?: string;
  };

  // Resolve email — may be null if the user keeps it private
  let email = userData.email ?? null;

  if (!email) {
    // Fall back to /user/emails to find the primary verified email
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers,
    });

    if (!emailsResponse.ok) {
      const errorBody = await emailsResponse.text();
      throw new Error(
        `Failed to fetch GitHub emails (${emailsResponse.status}): ${errorBody}`
      );
    }

    const emails = (await emailsResponse.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const primary = emails.find((e) => e.primary && e.verified);
    email = primary?.email ?? emails.find((e) => e.verified)?.email ?? null;
  }

  if (!email) {
    throw new Error(
      'Could not retrieve a verified email address from GitHub. ' +
        'Please ensure your GitHub account has a verified email address.'
    );
  }

  return {
    id: String(userData.id),
    email,
    name: userData.name ?? userData.login,
    avatar: userData.avatar_url,
  };
}

export function buildFacebookAuthUrl(state: string, baseUrl?: string, config?: OAuthProviderConfig): string {
  const clientId = requireConfigValue('FACEBOOK_CLIENT_ID', config?.clientId || process.env.FACEBOOK_CLIENT_ID);
  const redirectUri = getRedirectUri('facebook', baseUrl, config);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeFacebookCode(code: string, baseUrl?: string, config?: OAuthProviderConfig): Promise<{ accessToken: string }> {
  const clientId = requireConfigValue('FACEBOOK_CLIENT_ID', config?.clientId || process.env.FACEBOOK_CLIENT_ID);
  const clientSecret = requireConfigValue('FACEBOOK_CLIENT_SECRET', config?.clientSecret || process.env.FACEBOOK_CLIENT_SECRET);
  const redirectUri = getRedirectUri('facebook', baseUrl, config);
  const response = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  }).toString()}`);
  if (!response.ok) throw new Error(`Facebook token exchange failed (${response.status}): ${await response.text()}`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Facebook token exchange returned no access_token');
  return { accessToken: data.access_token };
}

export async function fetchFacebookProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch(`https://graph.facebook.com/me?${new URLSearchParams({
    fields: 'id,name,email,picture.type(large)',
    access_token: accessToken,
  }).toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch Facebook profile (${response.status}): ${await response.text()}`);
  const data = await response.json() as { id?: string; email?: string; name?: string; picture?: { data?: { url?: string } } };
  if (!data.id || !data.email) throw new Error('Facebook profile response is missing required id or email');
  return {
    id: data.id,
    email: data.email,
    name: data.name || data.email,
    avatar: data.picture?.data?.url,
  };
}
