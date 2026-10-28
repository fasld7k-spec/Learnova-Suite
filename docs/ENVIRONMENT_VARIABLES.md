# Environment Variables

Use `.env.example` for local demo mode and `.env.production.example` for production.

| Key | Demo value | Production note |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | PostgreSQL URL, for example `postgresql://USER:PASSWORD@HOST:5432/db?schema=public` |
| `JWT_SECRET` | demo string | Long random secret, never reuse the demo value |
| `SETTINGS_ENCRYPTION_KEY` | demo string | Required in production to encrypt admin-saved provider secrets |
| `TOTP_ENCRYPTION_KEY` | demo string | Required before enabling two-factor authentication; use exactly 32 UTF-8 bytes or 64 hex characters |
| `CONTENT_PROTECTION_SECRET` | demo string | Required in production for signed media/resource links |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Optional fixed public HTTPS app URL. If empty, the app auto-detects the current request domain; admins can also set Public site URL from General Settings. |
| `NEXT_PUBLIC_IOS_APP_URL` | empty | Optional App Store URL shown in the admin mobile-app panel |
| `NEXT_PUBLIC_ANDROID_APP_URL` | empty | Optional Google Play URL shown in the admin mobile-app panel |
| `LEARNOVA_APP_NAME` | `Learnova` | Flutter build define for buyer branding. Used with `--dart-define-from-file`, not in the Next.js `.env`. |
| `LEARNOVA_PACKAGE_NAME` | `com.yourcompany.learnova` | Flutter build define reference for buyer package id metadata and Android application id. iOS package id is `PRODUCT_BUNDLE_IDENTIFIER`. |
| `LEARNOVA_API_BASE_URL` | `http://10.0.2.2:3000/api` | Flutter build define for the buyer website URL or API root. Both `https://your-domain.com` and `https://your-domain.com/api` are accepted and normalized to `/api/mobile-app/...` for requests. |
| `LEARNOVA_SUPPORT_EMAIL` | `support@your-domain.com` | Flutter build define for buyer support contact. |
| `LEARNOVA_SUPPORT_URL` | `https://your-domain.com/support` | Flutter build define for buyer help center/support page. |
| `LEARNOVA_PRIVACY_URL` | `https://your-domain.com/privacy` | Flutter build define for buyer privacy policy. |
| `LEARNOVA_TERMS_URL` | `https://your-domain.com/terms` | Flutter build define for buyer terms of service. |
| `LEARNOVA_ENABLE_NETWORK_FALLBACK` | `true` locally | Flutter build define. Use `false` for production QA so API errors do not silently show local data. |
| `LEARNOVA_USE_MOCK` | `false` | Flutter build define. Set `true` only for offline demos/screenshots. |
| `PLATFORM_COMMISSION_PERCENT` | `15` | Platform commission percentage |
| `BASE_URL` | `http://127.0.0.1:3000` | Local smoke-test target URL |
| `CLIENT_IP_HEADER` | empty | Header holding the real client IP behind a CDN or proxy (for example `cf-connecting-ip` or `x-real-ip`). Empty uses the last `X-Forwarded-For` hop. Used for rate limiting and audit logs. |
| `DEMO_PASSWORD` | configurable local evaluation password | Demo account password used by smoke tests and seeded local evaluation accounts |
| `DEMO_MODE` | `true` | Set `false` in production |
| `PAYMENT_SANDBOX_MODE` | `true` | Set `false` only after real checkout providers are connected |
| `ALLOW_PRODUCTION_DEMO_PAYMENTS` | `false` | Keep `false` for live stores; set `true` only for a hosted production-built demo that must allow mock payments |
| `STORAGE_PROVIDER` | `local` | Use `s3`, `r2`, or another production storage provider |
| `ALLOW_LOCAL_UPLOADS` | `true` | Set `false` in production |
| `MEDIA_ALLOWED_HOSTS` | demo media hosts | Comma-separated allowlist for external protected media sources/CDNs |
| `S3_ENDPOINT` | empty | Required for S3-compatible storage such as Cloudflare R2, DigitalOcean Spaces, or MinIO |
| `S3_REGION` | empty | Storage region |
| `S3_BUCKET` | empty | Private bucket for videos, files, invoices, and protected assets |
| `S3_ACCESS_KEY_ID` | empty | Storage access key |
| `S3_SECRET_ACCESS_KEY` | empty | Storage secret key |
| `S3_PUBLIC_BASE_URL` | empty | Optional CDN/base URL for public assets only |
| `BACKUP_STORAGE_PROVIDER` | `local` | Use `s3` or `r2` for production backup exports |
| `BACKUP_RETENTION_DAYS` | `14` | Retention window for automated backup cleanup |
| `REDIS_URL` | empty | Optional production cache, distributed rate limit, and worker lock backend |
| `WEBHOOK_SECRET` | demo string | Shared webhook secret for custom integrations |
| `STRIPE_WEBHOOK_SECRET` | demo string | Stripe webhook signing secret |
| `LICENSE_ACTIVATION_SECRET` | demo string | Secret for purchase-code activation endpoint |
| `STRIPE_SECRET_KEY` | empty | Required for live Stripe Checkout sessions |
| `PAYPAL_CLIENT_ID` | empty | Required for live PayPal Orders API checkout |
| `PAYPAL_CLIENT_SECRET` | empty | Required for live PayPal Orders API checkout |
| `PAYPAL_WEBHOOK_ID` | empty | Required for official PayPal webhook verification |
| `PAYPAL_PUBLIC_CERT` | empty | Manual certificate value, normally not needed when using PayPal verify API |
| `PAYPAL_MODE` | `sandbox` | Use `live` for production PayPal API endpoints |
| `PAYPAL_BASE_URL` | empty | Optional PayPal API base URL override |
| `SMTP_HOST` | empty | SMTP host; when empty, emails are logged in demo mode only |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use `true` for SMTPS/465 |
| `SMTP_STARTTLS` | `true` | Use STARTTLS on non-secure ports |
| `SMTP_FROM` | empty | Sender email address |
| `SMTP_USER` | empty | SMTP username |
| `SMTP_PASS` | empty | SMTP password |
| `SMTP_EHLO_DOMAIN` | `localhost` | EHLO/HELO domain for SMTP servers that require it |
| `EMAIL_PROVIDER` | `demo` | `demo` logs email; use `smtp` after configuring SMTP settings |
| `EMAIL_THROW_ON_FAIL` | `false` | Set `true` in QA if failed transactional email should fail requests |
| `BUNNY_API_KEY` | empty | Optional Bunny Stream API key for instructor video uploads |
| `BUNNY_LIBRARY_ID` | empty | Optional Bunny Stream library ID |
| `BUNNY_CDN_HOSTNAME` | empty | Optional Bunny Stream CDN hostname for thumbnails/playback |
| `BUNNY_TOKEN_AUTH_KEY` | empty | Optional Bunny Stream token authentication key for signed playback |
| `BUNNY_WEBHOOK_SECRET` | empty | Required with Bunny Stream; verify processing callbacks via `x-bunny-webhook-secret` or HMAC signature |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | empty | Optional Google OAuth login credentials |
| `GOOGLE_REDIRECT_URI` | empty | Optional Google OAuth callback override |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | empty | Optional GitHub OAuth login credentials |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | empty | Optional Facebook OAuth credentials for custom extension |
| `FACEBOOK_REDIRECT_URI` | empty | Optional Facebook OAuth callback override |
| `OPENAI_API_KEY` | empty | Optional AI provider key when admin AI provider is set to OpenAI |
| `OPENROUTER_API_KEY` | empty | Optional OpenRouter key when admin AI provider is set to OpenRouter |
| `DEEPSEEK_API_KEY` | empty | Optional DeepSeek key when admin AI provider is set to DeepSeek |
| `AI_ASSISTANT_ENABLED` | `true` | Controls the public floating smart assistant when no admin override is saved; set `false` to hide it |
| `AI_PROVIDER` | `demo` | AI tools and smart assistant provider; keep `demo` for marketplace demos or set provider in admin |
| `AI_MODEL` | empty | Optional AI model override |
| `AI_ENDPOINT` | empty | Optional OpenAI-compatible endpoint override |
| `TOTP_ISSUER` | `Learnova Suite` | Issuer name shown in authenticator apps |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | empty | Provider credentials for a custom Razorpay implementation |
| `RAZORPAY_WEBHOOK_SECRET` | empty | Razorpay webhook signing secret for live webhook extension |
| `PAYSTACK_SECRET_KEY` | empty | Provider credentials for a custom Paystack implementation |
| `PAYSTACK_WEBHOOK_SECRET` | empty | Paystack webhook secret for live webhook extension |
| `FLUTTERWAVE_SECRET_KEY` | empty | Provider credentials for a custom Flutterwave implementation |
| `FLUTTERWAVE_SECRET_HASH` | empty | Flutterwave webhook verification hash |
| `FLUTTERWAVE_WEBHOOK_SECRET` | empty | Flutterwave webhook secret for live webhook extension |
| `MOLLIE_API_KEY` | empty | Provider credentials for a custom Mollie implementation |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` | empty | Provider credentials for a custom Iyzico implementation |
| `IYZICO_BASE_URL` | empty | Optional Iyzico API base URL override |
| `PAYMOB_API_KEY` | empty | Paymob API key |
| `PAYMOB_INTEGRATION_ID` | empty | Paymob integration ID |
| `PAYMOB_IFRAME_ID` | empty | Paymob hosted iframe ID |
| `PAYMOB_HMAC_SECRET` | empty | Paymob webhook HMAC secret |
| `TAP_SECRET_KEY` | empty | Provider credentials for a custom Tap implementation |
| `HYPERPAY_ACCESS_TOKEN` | empty | HyperPay access token |
| `HYPERPAY_ENTITY_ID` | empty | HyperPay entity/channel ID |
| `HYPERPAY_BASE_URL` | empty | Optional HyperPay API base URL override |
| `MIDTRANS_SERVER_KEY` | empty | Provider credentials for a custom Midtrans implementation |
| `MIDTRANS_CLIENT_KEY` | empty | Client-side key used by Midtrans Snap integrations |
| `MIDTRANS_IS_PRODUCTION` | `false` | Use Midtrans production endpoints |
| `XENDIT_SECRET_KEY` | empty | Provider credentials for a custom Xendit implementation |
| `XENDIT_WEBHOOK_TOKEN` | empty | Xendit callback verification token |
| `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` | empty | Provider credentials for a custom SSLCommerz implementation |
| `SSLCOMMERZ_IS_LIVE` | `false` | Use SSLCommerz live endpoints |
