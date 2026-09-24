# Integration Readiness

Learnova Suite ships with demo-safe integration settings that can be reviewed from the admin panel without sending real third-party traffic.

## Admin Screens

| Area | Admin path | Demo proof |
|---|---|---|
| Languages | `/admin/languages` | English LTR and Arabic RTL preview cards, active language table, and add/update form. |
| Currencies | `/admin/currencies` | USD, EUR, EGP, and SAR conversion preview using a sample course price. |
| Integrations | `/admin/integrations` | Google Analytics, Meta Pixel, Zapier, Mailchimp, Slack, Zoom, and Google Meet readiness matrix. |
| Payment gateways | `/admin/payment-gateways` | Sandbox/live readiness, required live env vars, and webhook routes. |
| AI assistant | `/admin/settings` | OpenAI, DeepSeek, OpenRouter, demo fallback, or custom OpenAI-compatible endpoint for the floating site-aware assistant. |
| Mobile app | `/admin/mobile-app` | iOS, Android, and PWA release metadata and store URL readiness. |

## Demo Mode

Seed data marks integrations and gateways as sandbox/demo ready. The settings are stored as JSON through Prisma so buyers can replace the demo values with provider credentials after deployment.

Recommended demo environment:

```bash
PAYMENT_SANDBOX_MODE=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Production Variables

| Provider | Required variables before live traffic |
|---|---|
| Google Analytics | `NEXT_PUBLIC_GA_ID` |
| Meta Pixel | `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` |
| Zapier | `ZAPIER_WEBHOOK_URL` |
| Mailchimp | `MAILCHIMP_API_KEY` |
| Slack | `SLACK_WEBHOOK_URL` |
| Zoom live sessions | Admin -> Integrations -> Zoom: account ID, client ID, client secret |
| Google Meet live sessions | Admin -> Integrations -> Google Meet: OAuth access token, or client ID + client secret + refresh token |
| OpenAI assistant | `OPENAI_API_KEY` or admin-saved key |
| DeepSeek assistant | `DEEPSEEK_API_KEY` or admin-saved key |
| OpenRouter assistant | `OPENROUTER_API_KEY` or admin-saved key |
| Public smart assistant toggle | `AI_ASSISTANT_ENABLED` or Admin -> Settings |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Paystack | `PAYSTACK_SECRET_KEY` |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY` |
| Mollie | `MOLLIE_API_KEY` |
| Iyzico | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` |
| Paymob | `PAYMOB_API_KEY` |
| Tap Payments | `TAP_SECRET_KEY` |
| HyperPay | `HYPERPAY_ACCESS_TOKEN` |
| Midtrans | `MIDTRANS_SERVER_KEY` |
| Xendit | `XENDIT_SECRET_KEY` |
| SSLCommerz | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` |

Offline methods such as manual payment, bank transfer, and cash on delivery do not require live provider keys.

## Live Class Providers

Instructors and admins can create live sessions with three provider modes:

- `External`: paste any hosted meeting URL manually.
- `Zoom`: leave the live-session URL empty and the platform creates a scheduled Zoom meeting through Server-to-Server OAuth.
- `Google Meet`: leave the live-session URL empty and the platform creates a Google Calendar event with a Meet conference link.

Configure the providers from `/admin/integrations`:

| Provider | Required admin fields | Optional fields | Notes |
|---|---|---|---|
| Zoom Server-to-Server OAuth | Account ID, Client ID, Client secret | User ID, Timezone | User ID defaults to `me`; timezone defaults to `UTC`. |
| Google Meet Calendar API | OAuth access token, or Client ID + Client secret + Refresh token | Calendar ID, Timezone | Refresh-token mode is recommended for production because the platform can obtain fresh access tokens automatically. Calendar ID defaults to `primary`; timezone defaults to `UTC`. |

Saved secrets are encrypted in the settings payload and are never printed back into the admin table.

## Webhooks

Payment providers use `/api/webhooks/{provider}` where `{provider}` matches the gateway slug, for example `/api/webhooks/stripe`. Integration providers that send outbound events should be configured with the provider webhook URL shown in `/admin/integrations`.

## Mobile App Handoff

The mobile app settings screen keeps PWA, iOS, and Android metadata in one place. Buyers can add store URLs with:

```bash
NEXT_PUBLIC_IOS_APP_URL=https://apps.apple.com/app/your-app
NEXT_PUBLIC_ANDROID_APP_URL=https://play.google.com/store/apps/details?id=your.app
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

The Flutter buyer package connects to the website through `/api/mobile-app`. `LEARNOVA_API_BASE_URL` can be either the website root (`https://your-domain.com`) or the API root (`https://your-domain.com/api`); the Flutter client and verification scripts normalize requests to `/api/mobile-app/...`.
Before building the mobile app for a buyer, verify:

```bash
curl https://your-domain.com/api/mobile-app
```

Then configure `learnova_flutter/env.production.json`:

```json
{
  "LEARNOVA_APP_NAME": "Your Academy",
  "LEARNOVA_PACKAGE_NAME": "com.yourcompany.academy",
  "LEARNOVA_API_BASE_URL": "https://your-domain.com",
  "LEARNOVA_SUPPORT_EMAIL": "support@your-domain.com",
  "LEARNOVA_SUPPORT_URL": "https://your-domain.com/support",
  "LEARNOVA_PRIVACY_URL": "https://your-domain.com/privacy",
  "LEARNOVA_TERMS_URL": "https://your-domain.com/terms",
  "LEARNOVA_ENABLE_NETWORK_FALLBACK": false,
  "LEARNOVA_USE_MOCK": false
}
```

Only build when an APK/AAB/IPA is requested. For Android APK delivery, build with:

```bash
flutter build apk --release --dart-define-from-file=env.production.json
```

Android reads the app name and package id from the define file. For iOS, use the same define file and set the buyer's `PRODUCT_BUNDLE_IDENTIFIER` and `APP_DISPLAY_NAME` in Xcode before archiving.

User-specific mobile routes use the `Authorization: Bearer <token>` header returned by mobile login/register. The Flutter app sets it automatically after auth; external mobile clients should do the same.

## Demo Checklist Coverage

Item 41 is covered by the language and currency seed data plus the admin previews. Item 43 is covered by the integrations, payment gateway readiness matrix, mobile app release settings, and this document.
