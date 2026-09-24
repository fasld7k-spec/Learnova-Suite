# Support Policy

This document explains what buyers can expect when using Learnova Suite.

## Included Support Scope

- Installation guidance for the included demo setup.
- Clarification of documented environment variables.
- Help identifying configuration issues with demo mode, PostgreSQL production setup, SMTP, payment credentials, and storage settings.
- Bug fixes for reproducible issues in the original source package.

## Not Included By Default

- Custom feature development.
- Server administration, domain/DNS setup, SSL certificates, or managed hosting.
- Replacing all sample content with buyer content.
- Creating or configuring third-party accounts such as Stripe, PayPal, SMTP, Bunny, S3/R2, OpenRouter, analytics, or push notification providers.
- Live payment certification, tax/legal compliance, or country-specific financial advice.
- Mobile app development or app store publishing.

## Buyer Checklist Before Asking For Support

1. Run `npm install`.
2. Run `npm run demo:setup`.
3. Run `npm run demo:doctor`.
4. Run `npm run release:check`.
5. For live deployments, run `npm run production:preflight` after filling `.env.production.example`.
6. Include the command output, Node.js version, npm version, hosting provider, database type, and the relevant `.env` variable names without secret values.

## Production Responsibility

Learnova Suite includes production-oriented foundations, but every live marketplace owner must configure real provider accounts, private media storage, SMTP, payment webhooks, legal pages, tax behavior, and licensed course content before accepting real users.


