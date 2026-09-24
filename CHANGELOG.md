# Changelog

## 1.0.0 - Initial CodeCanyon Release

### Added
- Next.js 16 LMS marketplace source with Student, Instructor, and Admin roles.
- SQLite demo setup and PostgreSQL production schema.
- Course marketplace with categories, search, filters, course details, cart, checkout, invoices, and certificates.
- Course builder foundations for instructors, including modules, lessons, resources, quizzes, assignments, announcements, drip content, FAQs, and live sessions.
- Protected lesson media flow with signed access checks and admin-configurable watermark settings.
- Student learning dashboard with my courses, progress, live sessions, assignments, resources, certificates, favorites, goals, notes, collections, and profile tools.
- Instructor dashboard with analytics, students, earnings, withdrawals, coupons, bookings, questions, availability, resources, quizzes, and live class management.
- Admin dashboard with users, instructors, courses, orders, payments, coupons, certificates, reports, settings, languages, themes, SEO, CMS, blog, support, security, integrations, and operational tools.
- Demo-safe payment mode plus native checkout foundations for Stripe Checkout, PayPal Orders, Mollie, Tap Payments, and Xendit.
- Admin-managed payment gateway extension points for hosted checkout URLs and provider-specific adapters.
- SMTP-ready email queue/logging foundations and admin email template management.
- Admin-selectable single active language with Arabic RTL, English LTR, and additional language dictionaries.
- Theme system with admin customization and seven admin-selectable homepage themes.
- SEO foundations including metadata, sitemap, robots, course/category pages, blog, and Open Graph-ready content.
- Buyer documentation, installation guide, environment variable reference, support policy, asset notes, third-party notices, and package validation scripts.

### Security
- HTTP-only cookie authentication and role-aware protected routes.
- Suspended/rejected user access checks.
- CSRF cookie/origin checks for unsafe requests.
- Security headers through `proxy.ts`.
- Upload MIME/size validation for instructor video upload.
- Signed protected media access for lesson videos/resources.
- Webhook idempotency and payment state handling foundations.

### Notes
- Demo mode is intended for CodeCanyon review and buyer evaluation.
- Production deployments must configure PostgreSQL, real secrets, SMTP, live payment credentials, webhooks, HTTPS, and private media storage.
