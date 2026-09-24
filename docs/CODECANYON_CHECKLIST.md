# CodeCanyon Packaging Checklist

## Demo-ready Included Features

- Next.js 16 source code, Prisma schemas, Tailwind UI, and documentation.
- SQLite demo mode that runs without external services.
- Seeded Admin, Instructor, and Student accounts.
- Course marketplace, cart, sandbox checkout, invoices, certificate verification, community, dashboards, blog, pages, live sessions, coupons, and settings.
- Demo-safe public image uploads plus signed protected lesson media/resource delivery.
- Demo-safe payment screens using `PAYMENT_SANDBOX_MODE=true`.
- English/Arabic language administration with LTR/RTL previews and seeded multi-currency conversion examples.
- External integration readiness matrix for analytics, automations, payment gateways, webhooks, and mobile app handoff.
- Demo credentials visible only when `DEMO_MODE=true` is explicitly enabled.
- PostgreSQL production schema and scripts for buyers who deploy live.
- Buyer-facing HTML documentation in `/documentation/index.html`.
- Public hosted documentation index at `/documentation`.
- Demo credentials in `/docs/DEMO_CREDENTIALS.md`.
- Production readiness notes in `/docs/PRODUCTION_READINESS.md`.
- Submission notes in `/docs/CODECANYON_SUBMISSION_NOTES.md`.
- Hosted demo redeploy gate in `/docs/HOSTED_DEMO_REDEPLOY.md`.
- Asset/license notes in `/docs/ASSET_LICENSES.md`.
- Support scope in `/docs/SUPPORT_POLICY.md`.
- Third-party notices in `/docs/THIRD_PARTY_NOTICES.md`.

## Reviewer Demo Commands

```bash
npm install
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Open `http://localhost:3000`.

Hosted review demo:

Use the updated Learnova Suite hosted demo URL after redeploying the new package.

Demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | value of `DEMO_PASSWORD` |
| Instructor | instructor@demo.com | value of `DEMO_PASSWORD` |
| Student | student@demo.com | value of `DEMO_PASSWORD` |

See `/docs/DEMO_CREDENTIALS.md` for the reviewer credential summary.
See `/documentation` on the hosted demo for the public buyer/reviewer documentation index.

## Before Upload

1. Stop any running `npm run dev` or `npm run demo:dev` process before building. On Windows, Prisma may not replace its query engine while the dev server is using it.
2. Run `npm run codecanyon:source-check`.
3. Run `npm run release:check`.
4. Start the demo server with `npm run demo:dev`.
5. In a second terminal, run `npm run demo:smoke`.
6. Run `npm run test`.
7. Run `npm run codecanyon:final-check`.
8. Redeploy the hosted demo from the current Learnova Suite package.
9. Confirm `/documentation` is reachable on the hosted demo.
10. Run `npm run codecanyon:pre-upload -- -HostedDemoUrl <VERIFIED_HTTPS_LIVE_PREVIEW_URL>`.
11. Confirm the strict pre-upload gate passes.
12. Upload the files from `Learnova-Suite-Complete-Ready-Upload`.

The packaging script excludes `.env`, `node_modules`, `.next`, local SQLite DB files, logs, uploaded demo files, root-level screenshots, local assistant/editor files, CI metadata, and internal phase/build reports. Automated test files are kept so buyer-visible npm scripts remain usable.

Do not upload an older ZIP that was generated before the current source changes. The validation command checks for stale runtime files, private environment files, and outdated package metadata.

## Suggested Tags

lms, education, marketplace, online courses, nextjs, saas, instructor, student, admin dashboard, certificates, live classes, ai assistant, messages, localization, learning platform
