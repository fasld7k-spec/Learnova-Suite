# Release Notes - Learnova Suite 1.0.0

## Highlights
- Live learning marketplace foundation with student, instructor and admin role flows.
- Student, instructor and admin dashboards.
- Courses, modules, lessons and quizzes.
- Live sessions with external provider links.
- Orders, manual payment workflow, coupons, subscriptions and bundles.
- Certificates with verification.
- CMS pages, blog, sliders, SEO and settings.
- Export center, audit logs, support tickets and maintenance pages.
- RTL/LTR and Arabic/English-ready UI foundation.

## Production Recommendations
- Configure live Stripe/PayPal credentials and provider webhooks, or add hosted checkout URLs for other gateways.
- Connect S3/R2 uploads or Bunny Stream before uploading production course libraries.
- Configure real SMTP provider.
- Keep same-origin mutation checks, SameSite cookies, and rate limiting enabled.
- Add automated tests before high-scale production use.
