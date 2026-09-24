# Hosted Demo Redeploy Gate

Use this checklist before placing a live demo URL in the marketplace submission form.

## Why This Matters

The hosted demo must run the current Learnova Suite codebase. Do not submit a URL that still serves an older rejected build, old branding, old demo data, or old marketplace copy.

## Server Steps

Run these on the demo server after uploading the current package:

```bash
npm install
npm run demo:setup
npm run demo:prepare-hosted
npm run demo:build
npm run start
```

If your hosted demo keeps uploads in a shared folder between releases, do not symlink `public/uploads` before `npm run demo:build`. Build first, then replace `public/uploads` and `storage/protected-uploads` with symlinks to the shared folders before restarting PM2 or your process manager.

For PostgreSQL-hosted demos, use the production schema sync commands from `docs/DEPLOYMENT.md`, then run:

```bash
npm run demo:prepare-hosted
npm run build:postgres
npm run start
```

## Local Verification

From your local project folder, run the strict pre-upload gate with the real HTTPS demo URL:

```bash
npm run codecanyon:pre-upload -- -HostedDemoUrl <VERIFIED_HTTPS_LIVE_PREVIEW_URL>
```

This command runs the full local quality gate, rebuilds the ready-upload folder, checks the hosted demo for old product markers, verifies `/api/version`, and confirms required upload files match the manifest hashes.

To verify the ready-upload folder without checking the hosted demo, run:

```bash
npm run codecanyon:verify-ready
```

## Pass Criteria

- The hosted homepage, demo page, public documentation page, courses page, course detail page, live sessions page, and `/api/version` load successfully.
- `/documentation` exposes the public buyer/reviewer documentation index.
- `/api/version` reports `Learnova Suite`.
- No old product markers are present.
- `Learnova-Suite-Complete-Ready-Upload/FINAL-QA-REPORT.md` has no skipped gates.
- `Learnova-Suite-Complete-Ready-Upload/FINAL-UPLOAD-MANIFEST.json` includes the required ZIP, documentation, preview, thumbnail, screenshots, and QA report.

Only after these checks pass should the hosted demo URL be added to the marketplace submission.
