# Operations Runbook

This runbook is written for the marketplace owner after installation. Demo mode works with SQLite and local uploads; production should use PostgreSQL, object storage, real payment keys, and a scheduled worker.

## Daily
- Review orders and manual payments.
- Review pending instructors and courses.
- Check support tickets and withdrawals.
- Check `/admin/jobs` and run due demo jobs, or verify the production cron worker is healthy.
- Check `/admin/backups` and confirm the last backup succeeded.

## Weekly
- Export reports.
- Review audit logs and login history.
- Test health endpoint.
- Verify backups.
- Review failed payments, failed jobs, security events, and suspicious login attempts.
- Test one full student checkout path using the active sandbox or manual payment flow.

## Release
- Run `npm run build`.
- Run the documented schema sync command for the target database.
- Update changelog/product updates.
- Test demo accounts.
- Confirm `DEMO_MODE=false`, `PAYMENT_SANDBOX_MODE=false`, `ALLOW_PRODUCTION_DEMO_PAYMENTS=false`, and real provider credentials before going live.
- Confirm `JWT_SECRET` is unique, long, and not copied from the demo examples.

## Backups
- Demo SQLite backup: `/admin/backups` creates a real copy of `prisma/dev.db` under `storage/backups`.
- Production PostgreSQL backup: use managed database backups or a scheduled `pg_dump` job to S3, Cloudflare R2, or another private object store.
- Keep backups private, encrypted where possible, and test restore steps before launch.
- Exclude `storage/backups` from deliverables and public hosting.

## Background Jobs
- `/admin/jobs` includes a demo runner for queued jobs such as email logs, notification cleanup, and report snapshots.
- Production should run a scheduled worker every 1-5 minutes against the same queue.
- Recommended production stack: hosted cron, GitHub Actions scheduler, server cron, or a queue worker backed by Redis.

## Cache
- Demo mode uses in-process and database-backed state only.
- Production can add Redis for rate limits, sessions, page cache invalidation, and background job locks.
- Do not use in-memory rate limiting as the only protection when running multiple app instances.

## Security
- The app ships with auth role guards, same-origin checks for mutating requests, broad API rate limiting, signed media URLs, and baseline security headers.
- Keep HTTPS enabled in production. HSTS is sent automatically when `NODE_ENV=production`.
- Never store raw card data in this app. Use hosted payment pages or tokenized payment elements from the provider.
- Restrict storage buckets and generate temporary URLs for private videos and files.
