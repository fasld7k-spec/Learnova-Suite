# Installation Guide

## One-command Demo Setup

Use this path for CodeCanyon review, local demos, and buyer evaluation.

```bash
npm install
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Open `http://localhost:3000`.

In a second terminal, run:

```bash
npm run demo:smoke
```

`demo:doctor` checks environment, Prisma, demo users, seeded courses, and theme settings before starting the server. `demo:smoke` checks key public pages and demo dashboards while the server is running.

For a full pre-release verification, stop the dev server first, then run:

```bash
npm run release:check
```

On Windows, stop `npm run demo:dev` before `npm run demo:build` or `npm run release:check`; Prisma may not replace its generated query engine while the dev server is holding it.

Demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | value of `DEMO_PASSWORD` |
| Instructor | instructor@demo.com | value of `DEMO_PASSWORD` |
| Student | student@demo.com | value of `DEMO_PASSWORD` |

The demo uses SQLite, seeded content, sandbox payment screens, visible demo credentials, and local uploads.

## Manual Demo Setup

```bash
copy .env.example .env
npm install
npx prisma db push
npm run prisma:seed
npm run dev
```

On macOS/Linux, use `cp .env.example .env`.

## Production Setup

1. Copy `.env.production.example` to `.env`.
2. Set `DATABASE_URL`, `JWT_SECRET`, webhook secrets, SMTP settings, and live payment keys. `NEXT_PUBLIC_APP_URL` is optional because the app can auto-detect the current domain; set Public site URL in Admin > General Settings for a fixed canonical domain.
3. Run:

```bash
npm install
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```

Production should keep:

```env
DEMO_MODE="false"
PAYMENT_SANDBOX_MODE="false"
ALLOW_PRODUCTION_DEMO_PAYMENTS="false"
ALLOW_LOCAL_UPLOADS="false"
```

After filling production environment values, run `npm run production:preflight`. It intentionally reports review items when used with demo/local `.env` files.

For custom domains or proxies, keep the original `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers intact. After login, open Admin > Domain Verification to verify the DNS TXT record and set the verified domain as the public URL.
