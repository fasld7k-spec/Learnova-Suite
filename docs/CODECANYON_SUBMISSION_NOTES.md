# CodeCanyon Submission Notes

Use this file when preparing the item upload page.

## Item Name

Learnova Suite - Live Learning Marketplace SaaS With Cohorts

## Recommended Category

CodeCanyon / JavaScript / Miscellaneous or the closest available SaaS/LMS web application category.

## Main File

`Learnova-Suite-Complete-Buyer-Package.zip`

## Requirements To Mention

- Node.js 20+
- npm 10+
- PostgreSQL 14+ for production deployments
- Modern Node-compatible hosting, VPS, Docker host, or platform that supports Next.js apps
- Not a PHP/shared-hosting-only script

## Reviewer Install Commands

```bash
npm install
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Open `http://localhost:3000`.

Recommended first page for reviewers: `/demo`.

The `/demo` page lists the role credentials and links to the main review flows: course purchase, student learning, instructor studio, admin control, install check, release checklist and gateway manager.

Recommended communication pages for technical review:

- `/messages` - authenticated user inbox with unread counts, participant routing and priority message controls.
- `/notifications` - priority notification inbox with search, read/unread filtering and event categories.
- `/admin/messages` - admin message operations dashboard for conversation health and recent volume.
- `/admin/support` - support command center with ticket age and SLA-risk signals.

Recommended visual-depth checks:

- `/?previewTheme=theme-1` through `/?previewTheme=theme-7` - seven distinct public homepage layouts.
- `/student` - redesigned learner dashboard with progress, calendar, course cards and achievements.
- `/instructor` - redesigned teacher dashboard with revenue, students, calendar, tasks and notifications.
- Floating "Smart help" widget - site-aware assistant powered by admin-selected AI provider or demo fallback.

UI/UX review notes:

- The shared design system was manually refined across global tokens, app shell, dashboard navigation, stat cards, data tables, badges, public navigation and course cards.
- The course catalog, course detail, login, register and footer surfaces were manually aligned with the refreshed UI system.
- Cart, checkout, manual payment, payment cancel, gateway confirmation and payment success pages were manually aligned for a consistent conversion flow.
- Public messages, conversation workspace, realtime chat, notification inbox, student notifications and instructor notifications were manually aligned with the refreshed communication UI.
- Help center, buyer FAQ, contact and support pages were manually aligned with the refreshed support and buyer-assurance UI.
- The dashboard mobile layout was checked for horizontal overflow and stable responsive spacing.

## Demo Accounts

- Admin: `admin@demo.com` / value of `DEMO_PASSWORD`
- Instructor: `instructor@demo.com` / value of `DEMO_PASSWORD`
- Student: `student@demo.com` / value of `DEMO_PASSWORD`

## Important Disclosure Text

Demo checkout screens are enabled for review and local evaluation. Live stores must configure production provider credentials, webhooks, HTTPS, SMTP, legal pages, and private media storage before accepting real users or real payments.

Included demo media is bundled for review and buyer customization. If extra media is used in hosted live previews, screenshots, or videos, disclose whether those assets are included in the download.

Do not upload any old rejected packages or archived folders. Use only `Learnova-Suite-Complete-Ready-Upload`.

## Verification Completed Before Upload

- `npm run codecanyon:source-check`
- `npm run localization:check`
- `npm run themes:check`
- `npm run themes:admin-check`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm test`
- `npm run demo:doctor`
- `npm run demo:build`
- `npm run demo:smoke`
- Messaging and notification behavior plus route-policy tests covering scoped inboxes, member-only replies, selected recipients, self-message rejection, auth/forbidden responses, single/bulk read scoping, pagination and bounded user-scoped event streams with selected fields
- Manual UI/UX pass across shared layout, navigation, cards, tables, badges and responsive dashboard behavior
- Manual conversion-flow UI/UX pass across cart, checkout, offline payment, payment cancel, gateway confirmation and payment success screens
- Manual communication UI/UX pass across messages, realtime chat, notifications, student notification center and instructor notification center
- Manual support-flow UI/UX pass across help center, buyer FAQ, contact and support ticket screens
- Manual homepage theme differentiation pass across modern catalog, launch poster, academic prospectus, developer pipeline, editorial magazine and pastel lifestyle layouts
- Visual asset QA confirmed Learnova Suite branding across course covers and preview media
- Homepage visual QA covered all seven preview themes on desktop and mobile
- `npm run codecanyon:validate-package`
