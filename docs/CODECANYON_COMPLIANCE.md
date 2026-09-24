# CodeCanyon Compliance Notes

This package is prepared for CodeCanyon as a combined buyer package with a Next.js web SaaS and a companion Flutter mobile app.

## Package Structure

- Inside the complete buyer package, `01-Website-SaaS/Learnova-Suite-Web-SaaS.zip` contains the editable web source.
- Inside the complete buyer package, `02-Mobile-App/Learnova-Suite-Mobile-App.zip` contains the editable Flutter project folder `learnova_flutter`.
- Inside the complete buyer package, `03-Documentation/Learnova-Suite-Documentation.zip` contains HTML and Markdown documentation.
- The outer seller organizer also includes preview images, screenshots, listing copy and reviewer notes for the upload form.

## Code Package Checks

- The web package does not include `node_modules`, `.next`, generated build output, or backup ZIP files.
- The Flutter package does not include `.dart_tool`, `build`, `.gradle`, nested distribution ZIPs, or IDE project files.
- The Flutter ZIP includes a real Flutter project folder with `learnova_flutter/pubspec.yaml`.
- Documentation is available as HTML and Markdown and covers installation, customization, APIs, mobile setup, payment setup, production readiness, assets, and support scope.

## Buyer Setup Positioning

The included local evaluation data and sandbox checkout are for installation testing only. Production deployments must use PostgreSQL, live secrets, real payment provider credentials, webhooks, SMTP or a transactional email provider, HTTPS, private media storage, and mock checkout disabled.

## Mobile App Integration

The Flutter app connects to the installed web backend through `/api/mobile-app`. Buyers should set `LEARNOVA_API_BASE_URL`, disable mock data, and disable network fallback before production mobile release builds.
