import { NextRequest, NextResponse } from 'next/server';
import { generateState, buildFacebookAuthUrl, buildGoogleAuthUrl, buildGithubAuthUrl } from '@/lib/oauth';
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam.toLowerCase();

  if (!isSupportedProvider(provider)) {
    return NextResponse.json(
      { error: 'Unsupported OAuth provider' },
      { status: 400 }
    );
  }

  const state = generateState();
  const appUrl = appUrlFromRequest(req);
  const settings = await getSiteSettings();

  let authorizationUrl: string;
  try {
    if (provider === 'google') {
      authorizationUrl = buildGoogleAuthUrl(state, appUrl, {
        clientId: settings.googleClientId,
        clientSecret: settings.googleClientSecret,
        redirectUri: settings.googleRedirectUri,
      });
    } else if (provider === 'github') {
      authorizationUrl = buildGithubAuthUrl(state, appUrl, {
        clientId: settings.githubClientId,
        clientSecret: settings.githubClientSecret,
        redirectUri: settings.githubRedirectUri,
      });
    } else {
      authorizationUrl = buildFacebookAuthUrl(state, appUrl, {
        clientId: settings.facebookClientId,
        clientSecret: settings.facebookClientSecret,
        redirectUri: settings.facebookRedirectUri,
      });
    }
  } catch {
    const url = new URL('/login', req.url);
    url.searchParams.set('oauth', provider);
    url.searchParams.set('status', 'demo-config-required');
    return NextResponse.redirect(url, 302);
  }

  const res = NextResponse.redirect(authorizationUrl, 302);

  res.cookies.set(stateCookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return res;
}
