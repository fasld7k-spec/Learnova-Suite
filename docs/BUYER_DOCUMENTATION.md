# Learnova Suite Buyer Documentation

Learnova Suite is a Next.js 16 live learning marketplace SaaS for courses, cohorts, instructor-led sessions, student dashboards, certificates, messaging, notifications, payments, and admin operations.

## Start Here

Read these files first:

- `documentation/index.html` - browser-friendly documentation index.
- `docs/QUICK_INSTALL.md` - shortest local and server setup path.
- `docs/RUN_AND_DEPLOY_STEPS.md` - full deployment guide.
- `docs/ENVIRONMENT_VARIABLES.md` - every important environment variable.
- `docs/PRODUCTION_READINESS.md` - live launch checklist.
- `docs/PAYMENT_GATEWAYS.md` - payment gateway setup notes.
- `docs/MARKETPLACE_LICENSE.md` - buyer license and support scope notes.
- `docs/ASSET_LICENSES.md` - asset and preview-image guidance.

## Local Evaluation Start

```bash
npm install
cp .env.demo.example .env
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Open:

```text
http://localhost:3000
```

Preview accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.com` | value of `DEMO_PASSWORD` |
| Instructor | `instructor@demo.com` | value of `DEMO_PASSWORD` |
| Student | `student@demo.com` | value of `DEMO_PASSWORD` |

Recommended local verification:

```bash
npm run demo:smoke
npm run release:check
```

## Production Setup

Production deployments should use PostgreSQL, HTTPS, strong secrets, SMTP, real payment credentials, provider webhooks, and private external storage.

```bash
cp .env.production.example .env
npm install
npm run production:preflight
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```

Important:

- SQLite is for local review only.
- Do not use preview credentials in production.
- Do not publish the `.env` file.
- Do not accept live payments until provider credentials and webhooks are configured and tested.
- Do not store paid videos or protected resources in public folders.

## Domain And URL Setup

The platform can auto-detect the active domain from request headers. For production, set a stable public URL in Admin > General Settings, for example:

```text
https://academy.example.com
```

If you use Nginx, Cloudflare, or another reverse proxy, forward:

```text
Host
X-Forwarded-Host
X-Forwarded-Proto
X-Real-IP
X-Forwarded-For
```

This keeps SEO URLs, payment return URLs, email links, OAuth callbacks, embeds, and affiliate links consistent.

## Mobile App API URL

The mobile app can be configured with either the site domain or the API base URL. Both forms are accepted by the app configuration:

```text
https://academy.example.com
https://academy.example.com/api
```

Use the same production domain as the web platform so mobile login, course enrollment, notifications, and learning progress stay synchronized.

## Main Modules

- Public marketplace homepage with seven admin-selectable homepage themes.
- Course catalog, filters, categories, course details, reviews, and checkout.
- Student dashboard with enrolled courses, progress, certificates, invoices, goals, notifications, and messages.
- Instructor dashboard with course creation, modules, lessons, resources, quizzes, live sessions, availability, coupons, earnings, withdrawals, students, reviews, and analytics.
- Admin dashboard with users, courses, approvals, orders, payments, coupons, themes, CMS pages, blog, certificates, reports, notifications, settings, integrations, webhooks, and add-ons.
- Certificate template management with public verification.
- Real-time style messages and in-app notifications.
- Demo/sandbox checkout plus live-provider foundations.
- Add-on center for safe metadata/webhook-based extensions.
- AI assistant with admin-configured providers or demo fallback.

## Admin Configuration Checklist

After installation:

1. Open Admin > Settings and set brand, support, currency, and public URL.
2. Open Admin > Theme and activate/customize one of the seven themes.
3. Open Admin > Languages and select the active language.
4. Open Admin > Payment Gateways and configure the providers you will use.
5. Open Admin > Email Templates and connect SMTP before live emails.
6. Open Admin > Certificate Templates and confirm certificate preview/verification.
7. Open Admin > Courses and replace sample content.
8. Open Admin > Pages and Blog and customize the default marketing text.
9. Open Admin > Release Checklist before launch.

## Payments

Demo mode includes safe checkout screens for review. Live payments require provider setup.

Supported payment foundations include Stripe Checkout, PayPal Orders, Razorpay, Paystack, Flutterwave, Mollie, Paymob, Tap Payments, Midtrans, Xendit, SSLCommerz, manual/offline payment, and hosted/extension gateway handling.

Before accepting live payments:

- Set `PAYMENT_SANDBOX_MODE=false`.
- Configure provider credentials in `.env` or Admin payment settings.
- Configure webhooks in the provider dashboard.
- Test sandbox callbacks.
- Run a low-value live test if your provider supports it.

## Email

Demo mode records email workflows in the database. For live delivery, configure SMTP or a transactional provider:

```text
EMAIL_PROVIDER=smtp
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@your-domain.com
```

Test registration, password reset, purchase confirmation, support replies, and certificate notifications.

## Uploads, Videos And Protected Files

Local uploads are for demo mode. Production should use private external storage or a secure video provider:

- Amazon S3
- Cloudflare R2
- Bunny Stream
- Cloudflare Stream
- DigitalOcean Spaces
- Compatible private object storage

Use `MEDIA_ALLOWED_HOSTS` for external media/CDN domains and keep protected lesson videos/files behind signed URLs or provider token authentication.

## Customization

Most site content is managed through Admin screens:

- Brand, URL, currency, and language: Admin > Settings.
- Homepage layout and text: Admin > Theme and Admin > Home Sections.
- Static pages: Admin > Pages.
- Blog posts: Admin > Blog.
- Payment providers: Admin > Payment Gateways.
- Email content: Admin > Email Templates.
- Certificate designs: Admin > Certificate Templates.
- Add-ons: Admin > App Marketplace.

Developers can customize Tailwind tokens in `tailwind.config.ts`, global CSS in `app/globals.css`, and React components in `app/` and `components/`.

## Support Scope

Included support covers installation guidance, configuration clarification, bug reports related to the included source, and documentation questions. It does not include creating third-party accounts, custom feature development, server administration, or payment-provider business approval.

Read `docs/SUPPORT_POLICY.md` for the full support scope.

