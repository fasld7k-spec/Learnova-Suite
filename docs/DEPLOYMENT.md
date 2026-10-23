# Deployment Guide

## Demo vs Production
Use SQLite only for local development and demos. Use PostgreSQL for production.

## Vercel + Managed PostgreSQL
1. Push the project to GitHub.
2. Create a Vercel project.
3. Copy `.env.production.example` to your host environment and replace every value.
4. Set `DATABASE_URL` to a Neon, Supabase, Railway, or other PostgreSQL database.
5. Generate the PostgreSQL Prisma client:
   ```bash
   npm run prisma:generate:postgres
   ```
6. Sync the PostgreSQL schema:
   ```bash
   npm run prisma:push:postgres
   ```
7. Build and start:
   ```bash
   npm run production:preflight
   npm run build:postgres
   npm run start
   ```
8. Run `npm run prisma:seed` only if you want sample content on that environment.

## Domain Setup
The app works on any domain without code changes. It auto-detects the current public URL from `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers. After deployment, open **Admin > General Settings** and set **Public site URL** if you want one fixed canonical domain for SEO, email links, payment returns, OAuth callbacks, embed widgets, affiliate links, sitemap, and robots.txt. `NEXT_PUBLIC_APP_URL` remains available as an optional environment fallback.

When running behind Nginx, Cloudflare, a load balancer, or a platform proxy, forward the original host and protocol. Login redirects, CSRF origin checks, payment callbacks, certificate links, and domain verification all use these headers:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Admins can also open **Admin > Domain Verification** to generate a TXT token, verify DNS, copy provider callback URLs, and set a verified domain as the Public site URL.

## VPS
1. Install Node.js 20+, PostgreSQL, and PM2.
2. Upload the project and configure `.env` from `.env.production.example`.
3. Run:
   ```bash
   npm install
   npm run production:preflight
   npm run prisma:generate:postgres
   npm run prisma:push:postgres
   npm run build:postgres
   pm2 start npm --name learnova -- start
   ```
4. Configure Nginx reverse proxy and HTTPS.

## Payment And Email
The package ships with demo-safe payment screens, order records, Stripe Checkout Session foundations, PayPal Orders API foundations, native redirect sessions for Razorpay, Paystack, Flutterwave, Mollie, Paymob, Tap Payments, Midtrans, Xendit, and SSLCommerz, provider webhook verification, generic signed webhook routes for extension providers, and queued email logs. Before live payments, set `PAYMENT_SANDBOX_MODE=false`, configure provider keys/webhooks, add hosted checkout URLs for providers that need inline/provider-specific handling, and run a real provider sandbox QA cycle. Before live email delivery, configure SMTP settings.

## Uploads
Local uploads are for demos. Lesson videos, attachments, and course resources are served through signed protected media URLs. For production, set `STORAGE_PROVIDER=s3` or `STORAGE_PROVIDER=r2`, configure the S3-compatible keys from `.env.production.example`, set `MEDIA_ALLOWED_HOSTS` to your CDN/video hosts, and keep `ALLOW_LOCAL_UPLOADS=false`.

Cloudflare R2, DigitalOcean Spaces, MinIO, and AWS S3 can use the included S3-compatible adapter. Set `S3_PUBLIC_BASE_URL` only for assets that should be public through a CDN.

Optional Bunny Stream uploads use `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`, `BUNNY_CDN_HOSTNAME`, `BUNNY_TOKEN_AUTH_KEY`, and `BUNNY_WEBHOOK_SECRET`. Set all five values together, configure Bunny callbacks to send `x-bunny-webhook-secret` or an HMAC signature, then add the Bunny CDN/iframe hostnames to `MEDIA_ALLOWED_HOSTS`.

