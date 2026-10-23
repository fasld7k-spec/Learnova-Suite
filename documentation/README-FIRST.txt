Learnova Suite Documentation
===========================

Start here:

1. Open documentation/index.html in your browser.
2. Read docs/QUICK_INSTALL.md for the fastest local demo and server setup path.
3. Read docs/RUN_AND_DEPLOY_STEPS.md for the complete local, VPS, PM2, Nginx and production deployment guide.
4. Read docs/GETTING_STARTED.md for the product overview and setup checklist.
5. Read docs/COMPLETE_PLATFORM_MANUAL.md for the full platform manual.
6. Read docs/ENVIRONMENT_VARIABLES.md before editing .env.
7. Read docs/PAYMENT_GATEWAYS.md before enabling live payment providers.
8. Read docs/PRODUCTION_READINESS.md before launching a live store.
9. Read docs/DEMO_CREDENTIALS.md for local demo accounts.

Quick demo:

npm install
cp .env.demo.example .env
npm run demo:setup
npm run demo:doctor
npm run demo:dev

Open http://localhost:3000

Demo accounts (DEMO_PASSWORD is password123 in .env.demo.example):

Admin: admin@demo.com / value of DEMO_PASSWORD
Instructor: instructor@demo.com / value of DEMO_PASSWORD
Student: student@demo.com / value of DEMO_PASSWORD

Production note:

Use PostgreSQL, HTTPS, strong secrets, SMTP, real payment credentials, provider webhooks and external object storage before accepting real users or payments.
SQLite, mock checkout and local uploads are included for local demo workflows only.
