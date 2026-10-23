# Learnova Suite Complete Platform Manual

This manual explains every major part of Learnova Suite from the buyer, admin, instructor, student and developer perspectives. Use it as the main customer-facing documentation after installation.

## 1. Product Overview

Learnova Suite is a full LMS marketplace and course selling SaaS built with Next.js 16, React, TypeScript, Tailwind CSS, Prisma and role-based dashboards.

It is designed for:

- Online academies.
- Course marketplaces.
- Individual instructors.
- Coaching platforms.
- Companies selling training programs.
- Education startups that need a configurable LMS foundation.

The platform includes:

- Public course marketplace.
- Course detail pages.
- Cart and checkout foundations.
- Student dashboard.
- Instructor studio.
- Admin control center.
- Course builder.
- Lesson, resource and quiz management.
- Live sessions and instructor availability.
- Certificates and certificate templates.
- Coupons and promotions.
- Orders, invoices and payment gateway settings.
- Messages and notifications.
- Add-on center.
- Homepage themes.
- Localization and currency foundations.
- Blog, CMS pages and SEO routes.
- Security, media protection and production readiness helpers.

## 2. User Roles

Learnova Suite ships with three main user roles.

### Admin

The Admin manages the full platform. Admin users can control users, courses, themes, settings, payments, content, reports, add-ons, languages, certificates, support and marketplace operations.

Main admin areas:

- Dashboard.
- Users.
- Instructors.
- Courses.
- Categories.
- Orders.
- Payment gateways.
- Coupons.
- Reviews.
- Reports.
- Settings.
- Homepage themes.
- Certificate templates.
- App marketplace / add-ons.
- Notifications.
- Live sessions.
- Security.
- SEO.
- Pages and blog.

### Instructor

The Instructor creates and manages courses, lessons, resources, coupons, live sessions, availability and student engagement.

Main instructor areas:

- Instructor dashboard.
- Course builder.
- Course modules.
- Lessons.
- Resources.
- Quizzes.
- Assignments.
- Coupons.
- Live sessions.
- Availability.
- Students.
- Questions.
- Earnings.
- Withdrawals.
- Analytics.
- Notifications.

### Student

The Student browses, buys and studies courses.

Main student areas:

- Student dashboard.
- My courses.
- Learning player.
- Progress.
- Certificates.
- Favorites.
- Invoices.
- Live sessions.
- Messages.
- Notifications.
- Bookmarks.
- Notes.
- Privacy and preferences.

## 3. Public Website

The public website is what visitors see before logging in.

### Homepage

The homepage is controlled by the Admin theme system. Admin can choose one active homepage theme and customize its text, images, calls to action and visual settings.

Homepage sections can include:

- Header and navigation.
- Hero section.
- Search.
- Featured courses.
- Categories.
- Learning paths.
- Instructor highlights.
- Student testimonials.
- Platform metrics.
- Calls to action.
- Footer links.

The default themes are stored in the homepage theme registry. New themes can be added later through the theme registry structure described in `docs/home-theme-system.md`.

### Navigation

The navigation includes key links such as:

- Courses.
- Learning paths.
- Career tracks.
- Instructors.
- Live sessions.
- Blog or pages.
- Login.
- Register.
- Cart.
- Language controls.

Navigation labels come from the localization dictionaries and site settings.

### Course Marketplace

The marketplace page lists published courses. It is designed for browsing and discovery.

Course cards typically show:

- Course title.
- Course image.
- Category.
- Price.
- Instructor.
- Short summary.
- Student count or metadata.
- Rating where available.

Common filters and sorting foundations include:

- Search by course title.
- Category filtering.
- Price filtering.
- Level filtering.
- Language filtering.
- Rating filtering.
- Newest / popular sorting foundations.

### Course Detail Page

The course detail page explains the course and encourages purchase or enrollment.

It can show:

- Course title.
- Course image or preview media.
- Short and long description.
- Instructor information.
- Rating.
- Number of students.
- Price and discount.
- Buy/add to cart actions.
- Wishlist/favorite actions.
- What students will learn.
- Requirements.
- Target audience.
- Course modules.
- Lessons.
- Duration.
- Level.
- Language.
- Certificate availability.
- Attachments/resources.
- Reviews.
- FAQs.
- Related courses.

### Instructor Profile

The public instructor profile can show:

- Instructor name.
- Avatar.
- Bio.
- Experience.
- Courses.
- Student count.
- Average rating.
- Social links.
- Availability schedule for live sessions or bookings.

Instructor availability can be managed by the instructor from the instructor dashboard.

### Legal Pages

The project includes routes and content foundations for:

- Terms.
- Privacy.
- Refund policy.
- Cookie policy.
- DMCA.
- Intellectual property.
- Instructor policy.
- Instructor agreement.
- Accessibility.

Admins can manage CMS-style page content from the admin panel where applicable.

## 4. Authentication

Learnova Suite uses email/password authentication with JWT HTTP-only cookies.

Included authentication features:

- Register.
- Login.
- Logout.
- Forgot password.
- Reset password.
- Email verification foundation.
- 2FA setup/verify/disable foundations.
- Login history.
- Rate limiting.
- Role-based redirects.
- Admin route protection.
- Instructor route protection.
- Student route protection.

Demo credentials are seeded by `npm run demo:setup`.

Production notes:

- Change all demo passwords.
- Use a strong `JWT_SECRET`.
- Use HTTPS.
- Keep cookies secure.
- Disable demo mode.

## 5. Admin Control Center

The Admin panel is the operational center of the platform.

### Admin Dashboard

The dashboard summarizes platform status:

- Total users.
- Total students.
- Total instructors.
- Total courses.
- Orders.
- Revenue.
- Recent activity.
- Pending course review foundations.
- Reports and operational links.

### Users

Admin can manage user accounts:

- View users.
- Search users.
- Filter by role.
- Approve/reject instructors.
- Suspend accounts.
- Edit user details foundations.
- Review login history.
- Review privacy requests.

### Courses

Admin can manage courses:

- View all courses.
- Publish courses.
- Reject courses.
- Edit course foundations.
- Feature courses.
- Import/export course data foundations.
- Assign categories.
- Review course reports.

### Categories

Admin can manage course categories:

- Add category.
- Edit category.
- Set slug.
- Configure Arabic/English names where available.
- Control marketplace organization.

### Orders And Invoices

Order management includes:

- View orders.
- Review payment status.
- Manual payment approval.
- Invoice foundations.
- Refund request foundations.
- Payment log foundations.

Order statuses can include:

- Pending.
- Paid.
- Failed.
- Cancelled.
- Refunded foundations.

### Payment Gateways

The platform includes gateway management foundations.

Included/demo-supported flows:

- Demo/mock checkout.
- Manual/offline payment.
- Stripe Checkout foundation.
- PayPal Orders foundation.
- Mollie foundation.
- Tap Payments foundation.
- Xendit foundation.
- Hosted checkout URL extension points.

Important:

The included online gateway screens are sandbox/demo foundations. Before accepting live payments, configure real API keys, webhook secrets, provider callback URLs, sandbox QA and production credentials.

### Coupons

Admin coupon management can cover:

- Coupon code.
- Discount type.
- Percentage or fixed amount.
- Start date.
- End date.
- Usage limits.
- Course restrictions.
- Active/inactive state.
- Redemption tracking.

Instructor coupons are also supported from the instructor area for instructor-owned courses.

### Homepage Themes

Admin can:

- View available homepage themes.
- Activate a theme.
- Open each theme customization page.
- Edit theme copy fields.
- Edit image/upload fields.
- Reset theme configuration.
- Preview themes with `/?previewTheme=theme-id`.

Themes are designed as separate homepage systems, not just color changes.

### Settings

Admin settings can include:

- Site name.
- Logo.
- Favicon.
- Support email.
- Support phone.
- Currency.
- Language.
- Public site URL.
- Commission settings foundations.
- Email settings.
- Payment settings.
- Certificate settings.
- White label settings.

### Languages

The platform supports multiple language dictionaries, while the Admin can choose one active site language at a time.

Included language foundations:

- English.
- Arabic RTL.
- French.
- Spanish.
- German.
- Turkish.
- Portuguese.

The Arabic UI is RTL-ready.

### Currencies

Currency foundations can include:

- Default currency.
- Conversion rates.
- Currency display.
- Admin-managed currency list.

### Certificate Templates

Admin can manage certificate templates:

- Template name.
- Visual style.
- Logo/watermark settings foundations.
- Public preview.
- Verification code display.
- Certificate verification page.

Certificates can include:

- Student name.
- Course name.
- Instructor name.
- Completion date.
- Certificate code.
- QR verification foundation.

### Add-on Center

The App Marketplace / Add-on Center is prepared for modular platform extensions.

Admin can:

- View available add-ons.
- Enable or disable add-ons.
- Configure supported add-on settings foundations.
- Use add-ons to extend certificate, live class, affiliate or other workflows.

### Notifications

Admin can review and create notification workflows:

- In-app notifications.
- Student notifications.
- Instructor notifications.
- Campaign foundations.
- Notification preference foundations.

### Messages

The platform includes authenticated messaging foundations:

- Conversations.
- Replies.
- Message stream endpoint foundation.
- User-to-user communication foundations.

### SEO

SEO foundations include:

- Sitemap route.
- Robots route.
- Course slugs.
- CMS page foundations.
- Blog pages.
- SEO metadata admin foundations.
- Redirect foundations.
- Open Graph foundations where configured.

### Security

Admin security areas and platform security features can include:

- Login history.
- Security settings.
- Audit log foundations.
- Rate-limit foundations.
- CSRF/origin checks.
- JWT HTTP-only cookies.
- Role checks.
- Security headers.
- Protected media helpers.

## 6. Instructor Studio

The instructor area is where course creators manage their content and students.

### Instructor Dashboard

The dashboard summarizes:

- Courses.
- Students.
- Revenue foundations.
- Ratings.
- Questions.
- Live sessions.
- Course activity.
- Analytics foundations.

### Course Builder

Instructors can create course drafts and organize them.

Course fields can include:

- Title.
- Slug.
- Description.
- Course image.
- Preview video/media foundation.
- Category.
- Level.
- Language.
- Price.
- Discount.
- Course duration.
- Requirements.
- Learning goals.
- Target audience.
- Free/paid state.
- Certificate availability.
- Status: draft, review, published, rejected foundations.

### Modules And Lessons

Course structure:

```text
Course
  Sections / Modules
    Lessons
      Video
      Text
      Attachments
      Quiz
```

Instructors can:

- Add modules.
- Add lessons.
- Reorder foundations.
- Add lesson summaries.
- Add resources.
- Add quizzes.
- Mark some lessons as free preview.

### Lesson Types

Lesson foundations can support:

- Video.
- Text.
- PDF/resource.
- Downloadable file.
- Quiz.
- Assignment.
- Live session reference.
- External URL.
- Free preview lesson.

### Video And Protected Media

The platform includes protected media access foundations:

- Access checks for enrolled users.
- Admin/instructor access.
- Preview lesson access.
- Signed media URL helper foundations.
- Content protection secret.
- Watermark/logo setting foundations.

Production recommendation:

Use Bunny Stream, Cloudflare Stream, Vimeo, S3/R2 private storage or another secure media provider. Do not rely on public local files for real paid course videos.

### Instructor Coupons

Instructors can create coupons for their own courses:

- Code.
- Discount.
- Course.
- Expiry.
- Usage status.

### Live Sessions

Instructor live session tools can include:

- Create live session.
- Set session date/time.
- Add meeting link.
- Connect to course.
- Mark free/paid access foundations.
- Manage student access.

### Availability

Instructors can manage availability:

- Weekly availability foundations.
- Public profile display.
- Booking/session planning foundations.
- Editable time slots.

### Questions And Answers

Instructor can reply to course or lesson questions where enabled:

- Student question.
- Instructor answer.
- Helpful answer foundations.
- Moderation/report foundations.

### Earnings And Withdrawals

Instructor finance foundations include:

- Revenue tracking.
- Platform commission foundations.
- Available/pending earnings foundations.
- Withdrawal request foundations.
- Payout method foundations.

## 7. Student Area

The student area focuses on learning, progress and certificates.

### Student Dashboard

The dashboard can show:

- Enrolled courses.
- Current progress.
- Continue learning.
- Certificates.
- Notifications.
- Live sessions.
- Recommendations.
- Bookmarks and notes.

### My Courses

Students can view purchased/enrolled courses:

- Course title.
- Progress percentage.
- Last lesson.
- Continue button.
- Certificate state.

### Learning Player

The learning page can include:

- Video/player area.
- Lesson list.
- Current lesson status.
- Previous/next lesson.
- Progress.
- Resources/downloads where allowed.
- Lesson summary.
- Questions/comments foundations.
- Quiz access.
- Complete lesson action.

Access protection:

- Non-enrolled users cannot access paid lessons.
- Preview lessons can be opened publicly when configured.
- Protected media helpers check enrollment before serving signed access.

### Progress Tracking

Progress foundations can track:

- Completed lessons.
- Current lesson.
- Progress percentage.
- Last activity.
- Last watched point foundations.
- Certificate eligibility foundations.

### Quizzes

Quiz foundations can include:

- Multiple choice.
- True/false foundations.
- Text answers foundations.
- Passing score.
- Attempt tracking.
- Results.
- Course/module/lesson connection.

### Certificates

Students can:

- View earned certificates.
- Open public certificate page.
- Verify certificate code.
- Print/download foundations.

### Favorites And Collections

Student can save courses:

- Favorites.
- Bookmarks.
- Collections foundations.
- Saved searches foundations.

### Notes

Student note foundations allow learners to keep course or lesson notes.

### Privacy And Preferences

Student can manage:

- Notification preferences.
- Privacy export request foundations.
- Data deletion request foundations.
- Account settings.

## 8. Checkout And Payment Flow

Learnova Suite includes a buyer-friendly checkout foundation.

### Cart

Cart can show:

- Selected courses.
- Course prices.
- Discounts.
- Coupon input.
- Total.
- Checkout action.
- Remove item action.

### Checkout

Checkout can show:

- Order summary.
- Payment method.
- Coupon application.
- Total.
- Secure payment note.
- Refund policy link.

### Demo Payment

Local evaluation mode includes mock checkout screens.

Use demo mode for:

- Local testing.
- Development.
- Feature walkthroughs.

Do not use demo mode for real payments.

### Manual Payment

Manual payment can support:

- Bank transfer instructions.
- Offline payment reference.
- Admin manual approval.

### Live Payment Providers

Before live payments:

- Configure provider API keys.
- Configure webhooks.
- Test provider sandbox.
- Disable `PAYMENT_SANDBOX_MODE`.
- Use HTTPS.
- Verify callback URLs.

## 9. Content And CMS

Learnova Suite includes content foundations:

- Blog posts.
- CMS pages.
- Knowledge base foundations.
- Product updates.
- Legal pages.
- Sliders.
- Home sections.

Admins can use these areas to customize public content without editing source code where routes/settings exist.

## 10. Add-ons And Extension System

The add-on system is designed to make future features modular.

Add-on concepts:

- Registry entry.
- Enabled/disabled state.
- Admin configuration.
- Feature-specific integration.

Existing add-on foundations can connect to:

- Certificate workflows.
- Live class workflows.
- Affiliate foundations.
- Other future modules.

Developer notes are available in `docs/ADDONS.md`.

## 11. Localization

Localization includes:

- UI dictionaries.
- RTL support for Arabic.
- LTR support for English and European languages.
- Admin active language setting.
- Page copy helpers.
- Navigation/footer label checks.

Important:

The current system is designed for one active site language at a time, selected by Admin.

## 12. Themes

Homepage themes are separate layouts.

Theme system capabilities:

- Theme registry.
- Admin listing.
- Activate button.
- Customize button.
- Dedicated customization page.
- Preview URL.
- Editable copy fields.
- Upload fields.
- Reset foundations.

To add a future theme:

1. Add a theme definition to the registry.
2. Add default settings.
3. Add renderer/layout support.
4. Confirm with `npm run themes:check`.
5. Confirm with `npm run themes:admin-check`.

See `docs/home-theme-system.md`.

## 13. Email System

Email foundations include:

- Email templates.
- Email log.
- Demo/log provider.
- SMTP configuration foundations.
- Transactional email provider extension points.

Emails can include:

- Registration.
- Password reset.
- Purchase success.
- Invoice.
- Certificate.
- Support reply.
- Notification.

Production:

Configure SMTP or an SMTP-compatible transactional provider. Do not rely on demo/log email for live users.

## 14. Security And Content Protection

Security foundations:

- JWT HTTP-only auth cookies.
- Role checks.
- Admin/instructor/student route guards.
- Origin checks for mutating requests.
- Rate limiting foundations.
- CSRF token cookie foundation.
- Security headers.
- Strong production secret checks.
- Login history.
- Audit foundations.
- Protected media access checks.

Content protection foundations:

- Paid lesson access checks.
- Preview lesson access.
- Signed protected media URL helper.
- Content protection secret.
- Watermark setting foundations.
- Recommendation to use external private media storage.

Important:

No web app can fully prevent screen recording. Learnova Suite focuses on access control, signed access and recommended secure media providers.

## 15. SEO And Marketing

SEO foundations:

- Course slugs.
- Public course pages.
- Sitemap.
- Robots.
- Blog routes.
- CMS pages.
- SEO admin foundations.
- Redirect foundations.
- Open Graph foundations.

Marketing foundations:

- Coupons.
- Bundles.
- Subscriptions foundations.
- Affiliate foundations.
- Push campaign foundations.
- Announcements.
- Blog content.
- Recommendations.

## 16. Reporting And Analytics

Admin reporting foundations can include:

- Sales.
- Users.
- Courses.
- Orders.
- Page views.
- Course views.
- Instructor reports.
- Payment reports.
- Export foundations.

Instructor analytics can include:

- Course visits.
- Interested users foundations.
- Students.
- Sales foundations.
- Ratings.
- Completion foundations.
- Questions/activity.

## 17. Production Environment Variables

Use `.env.production.example` as the starting point.

Critical variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `SETTINGS_ENCRYPTION_KEY`
- `TOTP_ENCRYPTION_KEY`
- `CONTENT_PROTECTION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `BASE_URL`
- `DEMO_MODE`
- `PAYMENT_SANDBOX_MODE`
- `ALLOW_LOCAL_UPLOADS`
- SMTP variables.
- Payment provider variables.
- Storage variables.
- Webhook secrets.

Read `docs/ENVIRONMENT_VARIABLES.md` before going live.

## 18. Demo Mode

Demo mode is meant for:

- Local evaluation.
- Development and testing.
- Feature walkthrough.

Demo mode can include:

- Demo users.
- Demo courses.
- Demo checkout.
- Demo email logging.
- Local storage.

Disable demo mode before live use.

## 19. Installation Summary

Quick demo:

```bash
npm install
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Production:

```bash
cp .env.production.example .env
npm install
npm run production:preflight
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```

## 20. Verification Commands

Use these commands during setup and support:

```bash
npm run demo:doctor
npm run demo:smoke
npm run localization:check
npm run themes:check
npm run themes:admin-check
npm run lint
npx tsc --noEmit --pretty false
npm run demo:build
npm run production:preflight
```

## 21. Common Problems

### Prisma engine locked on Windows

Stop any running dev server, then rerun the command.

### Demo database missing

Run:

```bash
npm run demo:setup
```

### Login redirects unexpectedly

Check:

- `NEXT_PUBLIC_APP_URL`
- `BASE_URL`
- Admin Public site URL setting.
- Reverse proxy `X-Forwarded-Proto` and `Host` headers.

### Payments stay in sandbox

Set:

```text
PAYMENT_SANDBOX_MODE=false
```

Then configure real provider credentials and webhooks.

### Emails are not sent

Configure SMTP or an SMTP-compatible transactional provider. Demo mode only records/logs email workflows.

### Uploaded media is not production-safe

Use S3/R2/Bunny/Cloudflare Stream or another private storage provider.

## 22. Support Scope

Included support can reasonably cover:

- Installation questions.
- Demo setup.
- Environment variable guidance.
- Build command issues.
- Documentation clarification.
- Bug reports for included source code.

Not usually included unless agreed separately:

- Custom feature development.
- Third-party provider account setup.
- Server administration.
- Data migration from another LMS.
- Mobile app development.
- Custom design work.

## 23. Buyer Launch Checklist

Before live launch:

- Replace sample content.
- Replace demo images and videos.
- Create real admin users.
- Change demo passwords.
- Use PostgreSQL.
- Configure HTTPS.
- Set strong secrets.
- Disable demo mode.
- Disable payment sandbox mode.
- Configure SMTP.
- Configure real payment providers.
- Configure provider webhooks.
- Configure storage/CDN/video provider.
- Review legal pages.
- Review refund policy.
- Run `npm run production:preflight`.
- Run a full checkout test in provider sandbox.

## 24. File Map

Important folders:

- `app/` - Next.js app routes and API routes.
- `components/` - UI components.
- `lib/` - shared logic, auth, settings, payments, localization and helpers.
- `prisma/` - database schema and seed data.
- `public/` - public assets.
- `storage/` - local storage placeholders.
- `docs/` - buyer documentation.
- `documentation/` - HTML documentation entry.
- `scripts/` - setup, checks, packaging and smoke tests.

## 25. Final Notes

Learnova Suite is a broad LMS marketplace foundation. It is evaluation-ready out of the box and production-oriented when configured with PostgreSQL, live providers, secure storage, HTTPS and real secrets.

For best results, launch with a small set of real courses first, validate checkout and student learning workflows, then enable advanced features such as subscriptions, affiliates, live class scaling and custom add-ons.

