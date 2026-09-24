import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  exchangeGoogleCode,
  exchangeFacebookCode,
  exchangeGithubCode,
  fetchFacebookProfile,
  fetchGoogleProfile,
  fetchGithubProfile,
} from '@/lib/oauth';
import { authCookieName, createToken, secureCookieOptions, type Role } from '@/lib/auth';
import { appUrlFromRequest } from '@/lib/app-url';
import { getSiteSettings } from '@/lib/site-settings';

type SupportedProvider = 'google' | 'github' | 'facebook';

const SUPPORTED_PROVIDERS = new Set<SupportedProvider>(['google', 'github', 'facebook']);

function isSupportedProvider(value: string): value is SupportedProvider {
  return SUPPORTED_PROVIDERS.has(value as SupportedProvider);
}

function stateCookieName(provider: SupportedProvider): string {
  return `learnova_oauth_state_${provider}`;
}

function loginError(req: NextRequest, message: string): NextResponse {
  const url = new URL('/login', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 302);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam.toLowerCase();

  if (!isSupportedProvider(provider)) {
    return loginError(req, 'unsupported_provider');
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate state parameter against the cookie to prevent CSRF
  const storedState = req.cookies.get(stateCookieName(provider))?.value;

  if (!state || !storedState || state !== storedState) {
    return loginError(req, 'invalid_state');
  }

  if (!code) {
    return loginError(req, 'missing_code');
  }

  try {
    // Exchange code for tokens
    let accessToken: string;
    const appUrl = appUrlFromRequest(req);
    const settings = await getSiteSettings();
    try {
      if (provider === 'google') {
        const tokens = await exchangeGoogleCode(code, appUrl, {
          clientId: settings.googleClientId,
          clientSecret: settings.googleClientSecret,
          redirectUri: settings.googleRedirectUri,
        });
        accessToken = tokens.accessToken;
      } else if (provider === 'github') {
        const tokens = await exchangeGithubCode(code, appUrl, {
          clientId: settings.githubClientId,
          clientSecret: settings.githubClientSecret,
          redirectUri: settings.githubRedirectUri,
        });
        accessToken = tokens.accessToken;
      } else {
        const tokens = await exchangeFacebookCode(code, appUrl, {
          clientId: settings.facebookClientId,
          clientSecret: settings.facebookClientSecret,
          redirectUri: settings.facebookRedirectUri,
        });
        accessToken = tokens.accessToken;
      }
    } catch {
      return loginError(req, 'code_exchange_failed');
    }

    // Fetch user profile from the provider
    let profile: { id: string; email: string; name: string; avatar?: string };
    try {
      if (provider === 'google') {
        profile = await fetchGoogleProfile(accessToken);
      } else if (provider === 'github') {
        profile = await fetchGithubProfile(accessToken);
      } else {
        profile = await fetchFacebookProfile(accessToken);
      }
    } catch {
      return loginError(req, 'profile_fetch_failed');
    }

    // Find-or-create user
    let user: { id: string; email: string; role: string };
    try {
      // 1. Look up OAuthAccount by [provider, providerAccountId]
      const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: profile.id,
          },
        },
        include: { user: true },
      });

      if (existingOAuthAccount) {
        // Found: use the linked user
        user = existingOAuthAccount.user;
      } else {
        // Not found: look up user by email
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        if (existingUser) {
          // Email exists: link the OAuthAccount to the existing user
          await prisma.oAuthAccount.create({
            data: {
              userId: existingUser.id,
              provider,
              providerAccountId: profile.id,
              accessToken,
            },
          });
          user = existingUser;
        } else {
          // Email doesn't exist: create a new User and OAuthAccount
          const newUser = await prisma.user.create({
            data: {
              name: profile.name,
              email: profile.email,
              passwordHash: '', // OAuth users have no password
              role: 'STUDENT',
              status: 'APPROVED',
              avatar: profile.avatar ?? null,
              oauthAccounts: {
                create: {
                  provider,
                  providerAccountId: profile.id,
                  accessToken,
                },
              },
            },
          });
          user = newUser;
        }
      }
    } catch {
      return loginError(req, 'database_error');
    }

    // Issue JWT session cookie
    const token = await createToken({
      id: user.id,
      email: user.email,
      role: user.role as Role,
    });

    const res = NextResponse.redirect(new URL('/dashboard', req.url), 302);

    // Set the session cookie
    res.cookies.set(authCookieName, token, secureCookieOptions());

    // Clear the OAuth state cookie
    res.cookies.set(stateCookieName(provider), '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return res;
  } catch {
    return loginError(req, 'unexpected_error');
  }
}
