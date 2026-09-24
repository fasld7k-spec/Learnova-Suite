# Phase 3 Development Report

Added production-oriented modules:
- Payment service abstraction with coupon discount and commission calculation.
- Manual payment approval API and Stripe/PayPal webhook placeholders.
- Favorites, reviews and questions APIs.
- Instructor question answering endpoint.
- Subscription, quiz, currencies, languages, payment methods and slider database models.
- Invoice page, subscription pricing page and certificate verification page.
- Middleware redirect for protected dashboard routes.
- SEO, i18n, email queue placeholder and PDF HTML render helpers.
- Richer seed data with coupon, subscription plan, currency, language and payment method.

Important: after schema changes run `npx prisma migrate dev --name marketplace_phase3` and `npm run prisma:seed`.
