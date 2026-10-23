# Learnova Suite Client Guide

Thank you for using Learnova Suite. This guide explains the fastest way to install, test, configure and launch the platform.

## 1. What Is Included

The repository includes:

- Full Next.js 16 source code.
- Complete platform manual in `docs/COMPLETE_PLATFORM_MANUAL.md`.
- Quick local/server install guide in `docs/QUICK_INSTALL.md`.
- Prisma SQLite local preview schema for quick local testing.
- Prisma PostgreSQL schema and production schema sync command.
- Admin, Instructor and Student dashboards.
- Course marketplace, checkout foundations, certificates, live sessions, messages, notifications, add-ons and themes.
- Documentation in `/docs`.
- HTML documentation in `/documentation/index.html`.
- Environment examples: `.env.example`, `.env.demo.example`, `.env.production.example`.

## 2. Requirements

- Node.js 20 or newer.
- npm 10 or newer.
- PostgreSQL 14 or newer for production.
- SMTP or an SMTP-compatible transactional email provider for production emails.
- S3/R2-compatible object storage for production uploads.
- HTTPS and strong secrets for production.

## 3. Quick Local Evaluation

Use this flow to test the project locally with SQLite preview data.

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
| Admin | admin@demo.com | value of `DEMO_PASSWORD` |
| Instructor | instructor@demo.com | value of `DEMO_PASSWORD` |
| Student | student@demo.com | value of `DEMO_PASSWORD` |

## 4. Production Setup

For live stores, use PostgreSQL and production environment values.

```bash
cp .env.production.example .env
npm install
npm run production:preflight
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```

Before going live, set:

- `DEMO_MODE=false`
- `PAYMENT_SANDBOX_MODE=false`
- `ALLOW_LOCAL_UPLOADS=false`
- Strong values for all secrets.
- Real SMTP settings.
- Real payment provider credentials and webhooks.
- External object storage for uploads and protected course media.

For the mobile application, set the API base to either `https://your-domain.com` or `https://your-domain.com/api`. The app normalizes both formats and uses the same web backend for authentication, courses, enrollment, notifications, profile data, and progress.

## 5. Admin Setup Checklist

After logging in as Admin:

1. Go to Admin > Settings and set site name, support email, currency and public site URL.
2. Go to Admin > Theme and choose/customize the homepage theme.
3. Go to Admin > Languages and choose the active site language.
4. Go to Admin > Payment Gateways and configure live providers.
5. Go to Admin > Email Templates and SMTP settings before sending real emails.
6. Go to Admin > Certificate Templates and configure certificate design.
7. Go to Admin > App Marketplace to manage add-ons.
8. Replace demo course content, images and lessons with your own licensed content.

## 6. Instructor Workflow

Instructors can:

- Create courses.
- Upload course cover images.
- Add modules and lessons.
- Add video/text/resource lessons.
- Mark lessons as free preview when needed.
- Create coupons for their courses.
- Manage live sessions and availability.
- Review students, questions and analytics.

## 7. Student Workflow

Students can:

- Browse courses.
- Add courses to cart.
- Use demo checkout in demo mode.
- Access purchased courses.
- Watch protected lessons.
- Track progress.
- Receive certificates.
- Use messages and notifications.

## 8. Payment Notes

The included payment flows are demo/sandbox foundations. Do not accept real money until you configure the provider credentials, webhook secrets, callback URLs and sandbox QA for your chosen payment provider.

## 9. Upload And Media Notes

Local uploads are suitable for demos only. For production, use private external object storage and a CDN/video provider such as S3/R2, Bunny Stream, Cloudflare Stream or a similar provider.

## 10. Security Notes

For production:

- Use HTTPS.
- Use strong unique secrets.
- Keep `.env` private.
- Do not commit API keys.
- Use PostgreSQL.
- Configure payment webhooks.
- Configure SMTP securely.
- Disable demo mode.
- Use protected media storage.

## 11. Useful Commands

```bash
npm run demo:doctor
npm run demo:smoke
npm run lint
npx tsc --noEmit --pretty false
npm run demo:build
npm run production:preflight
```

## 12. Support Request Template

When asking for support, include:

- Node.js version.
- npm version.
- Hosting provider.
- Database type.
- The command you ran.
- The full error message.
- Whether you are using demo mode or production mode.

Do not send passwords, private keys, API secrets or full `.env` files in public comments.
