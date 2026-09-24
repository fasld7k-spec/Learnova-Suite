# Learnova Suite - CodeCanyon Package Guide

## Package Contents

- Full Next.js application source code.
- Prisma SQLite demo schema, PostgreSQL production schema, and production schema sync command.
- Demo setup script and seeded demo database content.
- Buyer documentation in `/docs`.
- Buyer HTML documentation in `/documentation/index.html`.
- Demo credentials in `/docs/DEMO_CREDENTIALS.md`.
- Production readiness notes in `/docs/PRODUCTION_READINESS.md`.
- Submission notes in `/docs/CODECANYON_SUBMISSION_NOTES.md`.
- Asset/license notes in `/docs/ASSET_LICENSES.md`.
- Support scope in `/docs/SUPPORT_POLICY.md`.
- Third-party dependency notices in `/docs/THIRD_PARTY_NOTICES.md`.
- CodeCanyon packaging script.
- Demo-ready Admin, Instructor, and Student flows.

## Required Buyer Environment

- Node.js 20+
- npm 10+
- PostgreSQL 14+ only for production deployments

## Fast Demo Install

```bash
npm install
npm run demo:setup
npm run demo:dev
```

Open `http://localhost:3000`.

## Demo Accounts

- Admin: `admin@demo.com` / value of `DEMO_PASSWORD`
- Instructor: `instructor@demo.com` / value of `DEMO_PASSWORD`
- Student: `student@demo.com` / value of `DEMO_PASSWORD`

## Demo Behavior

The included `.env.example` is demo-ready:

- `DEMO_MODE=true` shows demo accounts.
- `PAYMENT_SANDBOX_MODE=true` enables mock checkout screens.
- `ALLOW_PRODUCTION_DEMO_PAYMENTS=false` keeps mock payment confirmation blocked if the app is built as production unless the owner explicitly enables a hosted demo.
- `ALLOW_LOCAL_UPLOADS=true` enables demo uploads; lesson media/resources are served through signed protected URLs.
- SQLite is used through `DATABASE_URL=file:./dev.db`.

## Production Build

Use `.env.production.example` and replace every placeholder before going live.

```bash
npm install
npm run production:preflight
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```

For live production, connect payment provider credentials/webhooks, SMTP, external object storage, `MEDIA_ALLOWED_HOSTS`, and strong encryption/signing secrets before accepting real users.

## Package Validation

Before creating the package, run:

```bash
npm run codecanyon:source-check
```

The packaging script runs source and package validation automatically. You can also run the package validation manually after creating the CodeCanyon ZIP:

```bash
npm run codecanyon:validate-package
```

The validation script checks that the ZIP does not include private `.env` files, build output, `node_modules`, uploaded demo files, local databases, logs, screenshots, or stale Next.js package metadata.

## Asset And Preview Notes

Read `docs/ASSET_LICENSES.md` before publishing the item. Included demo media is bundled for review and buyer customization. If you use extra preview-only media in CodeCanyon screenshots, videos, or the hosted live preview, list those assets in the item description and state whether they are included in the download.
