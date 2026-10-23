# Learnova Suite

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)

**Learnova Suite** is a free, open-source learning platform (LMS) and course marketplace built with Next.js, TypeScript and Prisma. It lets an academy or a group of instructors sell recorded courses and live classes, with separate dashboards for **Students**, **Instructors** and **Admins**, full Arabic (RTL) and English (LTR) support, and a JSON API for a mobile app.

> **نبذة بالعربي:** Learnova Suite منصة تعليمية مفتوحة المصدر (LMS + ماركت بليس للكورسات) مبنية بـ Next.js و TypeScript و Prisma. تقدر تستخدمها لبيع الكورسات المسجلة والحصص اللايف، وفيها لوحات تحكم منفصلة للطالب والمدرب والأدمن، ودعم كامل للعربي (RTL) والإنجليزي، وبوابات دفع متعددة. المشروع مجاني بالكامل تحت رخصة Apache 2.0 — استخدمه وعدّل عليه وابنِ عليه زي ما تحب.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start (local demo)](#quick-start-local-demo)
- [Demo accounts](#demo-accounts)
- [Clean local setup](#clean-local-setup)
- [Production deployment (PostgreSQL)](#production-deployment-postgresql)
- [Configuration](#configuration)
- [Useful scripts](#useful-scripts)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Security](#security)
- [Contributing](#contributing)
- [Author & license](#author--license)

---

## Features

**Students**
- Course catalog with categories, search and filters; cart, checkout, orders and invoices.
- Learning dashboard: my courses, progress tracking, quizzes, assignments, resources, notes, favorites and goals.
- Live sessions, certificates with public verification, notifications and messaging.

**Instructors**
- Course builder: modules, lessons, resources, quizzes, assignments, announcements, drip content and FAQs.
- Live class scheduling, bookings and availability.
- Student Q&A, analytics, earnings, coupons and withdrawal requests.

**Admins**
- Users, instructors, courses, orders, payments, coupons, certificates and reports.
- CMS: pages, blog, sliders, SEO settings, languages, currencies and seven selectable homepage themes.
- Support center, message operations, email templates, integrations and security settings.

**Platform**
- Arabic RTL and English LTR, with additional language dictionaries.
- Payments: manual/bank-transfer approval plus checkout integrations for Stripe, PayPal, Razorpay, Paystack, Flutterwave, Mollie, Paymob, Tap, Midtrans, Xendit and SSLCommerz; Iyzico and HyperPay adapters. Each gateway activates only when its keys are configured.
- Protected lesson media with signed URLs and optional watermarking; Bunny Stream support.
- Optional Google / GitHub / Facebook login, TOTP two-factor auth and an AI assistant (OpenAI, OpenRouter or DeepSeek).
- Mobile JSON API under `/api/mobile-app` for a companion mobile client (the mobile app itself is not part of this repository).

> Some integrations (payment gateways, email, storage) are provided as working foundations. Always test them in each provider's sandbox before taking real payments.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 18, TypeScript |
| Database | Prisma ORM — SQLite for local development, PostgreSQL for production |
| Styling | Tailwind CSS |
| Auth | JWT in HTTP-only cookies, role-based access control, CSRF checks |
| Validation | Zod |
| Testing | Vitest, Playwright |

## Quick start (local demo)

Requirements: **Node.js 20+** and npm.

```bash
git clone https://github.com/fasld7k-spec/Learnova-Suite.git
cd Learnova-Suite
npm install
cp .env.demo.example .env
npm run demo:setup     # creates the SQLite database and seeds demo data
npm run demo:doctor    # checks that the environment is ready
npm run demo:dev
```

Then open <http://localhost:3000>.

With the dev server running, you can smoke-test the main pages and dashboards:

```bash
npm run demo:smoke
```

> On Windows PowerShell use `copy .env.demo.example .env` instead of `cp`.

## Demo accounts

The demo seed creates these accounts. The password is the value of `DEMO_PASSWORD` in `.env.demo.example` (`password123` by default).

| Role | Email |
|---|---|
| Admin | `admin@demo.com` |
| Instructor | `instructor@demo.com` |
| Student | `student@demo.com` |

**Never use these accounts or passwords on a public deployment.**

## Clean local setup

To start with an empty, non-demo configuration on SQLite:

```bash
cp .env.example .env     # then fill in the secrets
npm install
npx prisma db push
npm run prisma:seed
npm run dev
```

## Production deployment (PostgreSQL)

1. Start a PostgreSQL database. For local testing you can use the included Docker Compose file:
   ```bash
   docker compose up -d
   ```
2. Copy `.env.production.example` to `.env` and set `DATABASE_URL` and all secrets.
3. Build and run:
   ```bash
   npm install
   npm run prisma:generate:postgres
   npm run prisma:push:postgres
   npm run build:postgres
   npm run start
   ```

Before going live, make sure that:

- `DEMO_MODE=false`, `PAYMENT_SANDBOX_MODE=false`, `ALLOW_PRODUCTION_DEMO_PAYMENTS=false` and `ALLOW_LOCAL_UPLOADS=false`.
- `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY`, `TOTP_ENCRYPTION_KEY` and `CONTENT_PROTECTION_SECRET` are long random values.
- The site is served over HTTPS and payment webhooks are configured and verified.
- SMTP (or another email provider) is configured — without it, emails are only logged, not sent.
- Lesson media is stored in private storage (S3, R2, Bunny, Cloudflare Stream, …), not local uploads.

You can run `npm run production:preflight` to check the configuration. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) for details.

## Configuration

All configuration is done through environment variables. There are three templates:

| File | Use it for |
|---|---|
| `.env.demo.example` | Local demo with sample data and sandbox payments |
| `.env.example` | Clean local or server setup |
| `.env.production.example` | Live deployments |

The full list of variables is documented in [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md), and payment setup in [docs/PAYMENT_GATEWAYS.md](docs/PAYMENT_GATEWAYS.md).

## Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm run start` | Production build and server (SQLite schema) |
| `npm run build:postgres` | Production build with the PostgreSQL schema |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests with Vitest |
| `npm run release:check` | Full pre-release check: environment, localization, routes, admin panel, themes, lint, type-check and build |
| `npm run production:preflight` | Validate production environment settings |

## Project structure

```
app/            Next.js routes (public pages, dashboards, API under app/api)
components/     Shared React components
lib/            Business logic, auth, payments, i18n and helpers
hooks/          React hooks
prisma/         Prisma schemas (SQLite + PostgreSQL), migrations and seed
scripts/        Setup, check and audit scripts
docs/           Guides and manuals
documentation/  Offline HTML documentation
public/         Static assets
proxy.ts        Security headers and request middleware
```

## Documentation

- [Installation](docs/INSTALLATION.md) · [Quick install](docs/QUICK_INSTALL.md) · [Run & deploy steps](docs/RUN_AND_DEPLOY_STEPS.md)
- [Complete platform manual](docs/COMPLETE_PLATFORM_MANUAL.md)
- Role guides: [Admin](docs/ADMIN_MANUAL.md) · [Instructor](docs/INSTRUCTOR_MANUAL.md) · [Student](docs/STUDENT_MANUAL.md)
- [API reference](docs/API.md) · [Postman collection](docs/postman_collection.json) · [Database schema](docs/DATABASE_SCHEMA.md)
- [Integrations](docs/INTEGRATIONS.md) · [Homepage themes](docs/home-theme-system.md) · [Testing](docs/TESTING.md)
- [Third-party notices](docs/THIRD_PARTY_NOTICES.md) · [Asset licenses](docs/ASSET_LICENSES.md)

## Security

See [SECURITY.md](SECURITY.md) for the production checklist and the built-in controls. Please report vulnerabilities privately rather than in public issues.

## Contributing

Contributions are welcome — bug reports, fixes, translations and new features. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Author & license

Learnova Suite is created and maintained by **Eng. Sayed Afandy** — [sayedafandy.com](https://sayedafandy.com), an online academy teaching programming, AI and computer science to secondary-school and university students.

Copyright © 2026 Eng. Sayed Afandy. Licensed under the [Apache License 2.0](LICENSE) — you are free to use, modify and distribute this project, including commercially, as long as you keep the license and [NOTICE](NOTICE) file.
