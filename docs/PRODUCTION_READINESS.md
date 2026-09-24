# Production Readiness

This checklist is for buyers preparing a live marketplace after local evaluation.

## Required Before Launch

- Replace `.env.example` with `.env.production.example` values.
- Use PostgreSQL instead of SQLite.
- Set strong unique values for all secrets.
- Set `DEMO_MODE=false`.
- Set `ALLOW_PRODUCTION_DEMO_PAYMENTS=false`.
- Set `PAYMENT_SANDBOX_MODE=false`.
- Set `ALLOW_LOCAL_UPLOADS=false`.
- Configure HTTPS and the correct `NEXT_PUBLIC_APP_URL`.
- Configure SMTP or an SMTP-compatible transactional email provider.
- Configure private media storage for lesson videos and resources.
- Configure payment provider credentials and webhook secrets.
- Confirm mock checkout is disabled before accepting real money.
- Confirm message, notification and support workflows use production SMTP/push/webhook settings where your deployment requires real-time delivery outside the in-app inbox.
- Test provider sandbox flows end to end.
- Replace sample assets, sample users, sample content, and sample legal text.
- Review local laws for taxes, refunds, privacy, instructor payouts, and digital content sales.

## Recommended

- Use a process manager or managed hosting platform for `npm run start`.
- Put a CDN in front of public assets.
- Keep protected lesson media behind signed URLs or a private video provider.
- Enable database backups and restore testing.
- Monitor errors, slow routes, payment webhooks, and failed login attempts.
- Monitor unread message queues, notification delivery failures and support tickets approaching SLA limits.
- Keep dependencies updated and run `npm audit --audit-level=moderate`.

## Payment Safety Guard

Mock checkout and sandbox references are included only for local evaluation. Production storefronts must use a configured payment provider, real webhook secrets, and `PAYMENT_SANDBOX_MODE=false`.

## Production Commands

```bash
npm install
npm run production:preflight
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```


