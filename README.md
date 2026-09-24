# Learnova Suite

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

Learnova Suite is a production-oriented educational SaaS / marketplace application for selling online courses and live classes with Student, Instructor and Admin roles.

## Author & License

Learnova Suite is created and maintained by **Eng. Sayed Afandy** — [sayedafandy.com](https://sayedafandy.com), an online academy teaching programming, AI, and computer science to secondary-school and university students.

This project is released as free and open source software under the **Apache License 2.0** (see [LICENSE](./LICENSE) and [NOTICE](./NOTICE)) so that other developers and educators can freely use, study, modify, and build on it.

Copyright © 2026 Eng. Sayed Afandy ([sayedafandy.com](https://sayedafandy.com)). All rights reserved under the terms of the Apache License 2.0.

## Stack
- Next.js 16 App Router + TypeScript
- PostgreSQL production schema + SQLite local/preview schema with Prisma ORM
- Tailwind CSS
- JWT HTTP-only cookie authentication
- Role-based access control

## Local Evaluation Accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | value of `DEMO_PASSWORD` |
| Instructor | instructor@demo.com | value of `DEMO_PASSWORD` |
| Student | student@demo.com | value of `DEMO_PASSWORD` |

## Installation
Local evaluation setup:
```bash
npm install
cp .env.demo.example .env
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Open http://localhost:3000

With the preview server running, verify the important public pages and role dashboards:

```bash
npm run demo:smoke
```

Clean local SQLite development:
```bash
cp .env.example .env
npm install
npx prisma db push
npm run prisma:seed
npm run dev
```

PostgreSQL deployment build:
```bash
npm install
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```

The default `.env.example` is a buyer environment example with preview mode disabled. Use `.env.demo.example` only for local evaluation data, and use `.env.production.example` for live deployments. Keep `DEMO_MODE=false`, `PAYMENT_SANDBOX_MODE=false`, `ALLOW_PRODUCTION_DEMO_PAYMENTS=false`, and `ALLOW_LOCAL_UPLOADS=false` on production deployments.

After deploying a public marketplace preview, verify the hosted URL before submission:

```bash
npm run hosted-demo:check -- <VERIFIED_HTTPS_LIVE_PREVIEW_URL>
```

Payment flows include local-evaluation-safe checkout, manual payment approval, and native checkout foundations for Stripe Checkout, PayPal Orders, Razorpay, Paystack, Flutterwave, Mollie, Paymob, Tap Payments, Midtrans, Xendit, and SSLCommerz when provider credentials are configured. Iyzico and HyperPay adapters are available as inline/provider-specific integrations and can also be enabled through hosted checkout URLs. Run provider sandbox QA, configure webhooks, and keep `PAYMENT_SANDBOX_MODE=false` before accepting real money.

The email helper records queued email logs for preview workflows; connect SMTP or a transactional email provider before relying on live email delivery. Local file uploads are intended for private local evaluation; use private S3/R2/Bunny/Cloudflare Stream style storage for protected lesson media on public deployments. See `docs/ASSET_LICENSES.md` before replacing preview media or publishing item previews.

The companion Flutter app connects to this same web backend through `/api/mobile-app`. Configure the mobile app with `LEARNOVA_API_BASE_URL=https://your-domain.com`, `LEARNOVA_USE_MOCK=false`, and `LEARNOVA_ENABLE_NETWORK_FALLBACK=false`; see `docs/API.md` and the mobile app `BUYER_SETUP.md`.

## Main Modules
Course marketplace, course details, dashboards, live sessions, checkout/order/invoice foundation, certificate verification, advanced messaging, priority notifications, admin AI rewrite workflow, admin message operations, support command center, settings, content pages, blog, RTL/LTR support and modern dark UI styling.

## Communication Quality
- Authenticated message center with participant-aware conversations, unread counters, quick replies and priority markers.
- Admin message operations page for reviewing conversation volume, recent activity and participant routing.
- Priority notification inbox with search, read/unread filtering and category badges for commerce, messages, live sessions, learning and system events.
- Support command center with SLA risk signals and linked message workflow.
- Communication surfaces were visually refined across public inbox, conversation workspace, realtime chat, notification inbox, student notifications and instructor notifications.
- Behavior and route-policy tests cover user-scoped inbox access, conversation membership, self-message rejection, auth/forbidden responses, recipient-targeted notifications, single/bulk notification read scoping, bounded pagination, and user-scoped event streams with minimal selected fields.

## UI/UX Quality
- Shared visual system with consistent app background, panels, borders, focus states, scrollbars, card radius, and control typography.
- Dashboard shell, navigation, stat cards, badges, data tables, public navigation, and course cards use the same polished surface language.
- Course catalog, course detail, login, register and footer surfaces are aligned with the refreshed UI system.
- Cart, checkout, manual payment, payment cancel, gateway confirmation and payment success screens share the same conversion-focused panel system.
- Messages, realtime chat and notification inboxes now share the same refined surfaces, search/filter controls, live-state indicators and responsive spacing.
- Help center, buyer FAQ, contact and support pages use the refreshed support-flow UI with consistent panels, forms and status states.
- Desktop and mobile dashboard views are checked for readable spacing, stable containers, and no page-level horizontal overflow.

See `documentation/index.html`, `docs/COMPLETE_PLATFORM_MANUAL.md`, `docs/QUICK_INSTALL.md`, `docs/RUN_AND_DEPLOY_STEPS.md`, `docs/CLIENT_GUIDE.md`, `docs/BUYER_DOCUMENTATION.md`, `docs/DEMO_CREDENTIALS.md`, `docs/PRODUCTION_READINESS.md`, `docs/DOCUMENTATION.md`, `docs/API.md`, `docs/DATABASE_SCHEMA.md`, `docs/INSTALLATION.md`, `docs/ASSET_LICENSES.md`, and `docs/home-theme-system.md`.

## CodeCanyon Checks

Before creating a buyer ZIP, run:

```bash
npm run codecanyon:source-check
npm run release:check
```

After creating the ZIP, run:

```bash
npm run codecanyon:validate-package
```

Final upload gate:

```bash
npm run codecanyon:final-check
npm run codecanyon:pre-upload -- -HostedDemoUrl <VERIFIED_HTTPS_LIVE_PREVIEW_URL>
```
