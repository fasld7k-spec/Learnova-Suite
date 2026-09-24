# Security Policy

Learnova Suite ships with demo-safe defaults, role checks, signed protected media access, input validation, and payment webhook foundations. Production owners must still configure their own secrets, infrastructure, and provider accounts before accepting real users.

## Production Requirements

- Use strong unique values for `JWT_SECRET`, `CONTENT_PROTECTION_SECRET`, webhook secrets, API keys, and storage credentials.
- Serve the app over HTTPS only.
- Set `DEMO_MODE=false`, `PAYMENT_SANDBOX_MODE=false`, and `ALLOW_LOCAL_UPLOADS=false` in production.
- Use PostgreSQL for production deployments.
- Use private object storage or a protected video provider for lesson media and downloadable resources.
- Keep public course covers separate from protected lesson media.
- Verify Stripe, PayPal, and any other provider webhook signatures before finalizing paid orders.
- Configure provider sandbox tests before enabling live payments.
- Keep dependencies updated and run `npm audit --audit-level=moderate`.

## Included Controls

- HTTP-only JWT cookie authentication.
- Role-aware route protection for Admin, Instructor, and Student areas.
- Suspended/rejected user checks in protected user flows.
- CSRF cookie and origin checks for unsafe requests.
- Security headers through `proxy.ts`, including CSP, frame protections, content type protections, and referrer policy.
- Rate limiting hooks for sensitive routes.
- Protected lesson media signing and access verification.
- Upload MIME and size validation on instructor video upload endpoints.
- Webhook idempotency and payment state handling foundations.

## Deployment Notes

The demo database, local uploads, and mock checkout screens are for review and local evaluation. Do not reuse demo credentials, demo media, or local SQLite for a live marketplace.

## Reporting Issues

When reporting a security issue, include the affected route or feature, reproduction steps, expected behavior, actual behavior, and whether the issue occurs in demo mode, production mode, or both. Never share live secrets in support tickets.
