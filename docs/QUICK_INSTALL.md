# Learnova Suite Quick Install

Use this guide when you want the shortest safe installation path. For the full deployment manual, read `docs/RUN_AND_DEPLOY_STEPS.md`.

## 1. Local Demo Install

Local demo mode is intended for buyer review, CodeCanyon review, and development.

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- Windows, Linux, or macOS
- Internet access for npm installation

Commands:

```bash
npm install
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Open:

```text
http://localhost:3000
```

Demo accounts:

```text
Admin: admin@demo.com / value of `DEMO_PASSWORD`
Instructor: instructor@demo.com / value of `DEMO_PASSWORD`
Student: student@demo.com / value of `DEMO_PASSWORD`
```

Optional verification while the demo server is running:

```bash
npm run demo:smoke
```

Full local release verification:

```bash
npm run release:check
```

Stop `npm run demo:dev` before running production builds on Windows if Prisma reports locked files.

## 2. Production Server Install

Production deployments must use PostgreSQL. SQLite is included only for local/demo review.

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 14 or newer
- HTTPS domain
- SMTP or SMTP-compatible transactional email provider
- Payment provider credentials and webhooks for live payments
- External private storage for paid videos/files, such as S3, Cloudflare R2, Bunny Stream, Cloudflare Stream, or DigitalOcean Spaces

Commands:

```bash
cp .env.production.example .env
npm install
npm run production:preflight
npm run prisma:generate:postgres
npm run prisma:push:postgres
npm run build:postgres
npm run start
```

Minimum production `.env` checklist:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=strong-random-value
SETTINGS_ENCRYPTION_KEY=strong-random-value
TOTP_ENCRYPTION_KEY=replace-with-exactly-32-utf8-bytes-or-64-hex-characters
CONTENT_PROTECTION_SECRET=strong-random-value
NEXT_PUBLIC_APP_URL=https://your-domain.com
BASE_URL=https://your-domain.com
DEMO_MODE=false
PAYMENT_SANDBOX_MODE=false
ALLOW_LOCAL_UPLOADS=false
EMAIL_PROVIDER=smtp
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@your-domain.com
```

## 3. PM2 Example

```bash
npm install -g pm2
pm2 start npm --name learnova -- run start
pm2 save
```

Useful commands:

```bash
pm2 status
pm2 logs learnova
pm2 restart learnova
```

## 4. Nginx Reverse Proxy Example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

After saving the file:

```bash
nginx -t
systemctl reload nginx
certbot --nginx -d your-domain.com
```

## 5. First Admin Setup

After installation:

1. Login as Admin.
2. Open Admin > Settings and set the site name, support email, currency, and public site URL.
3. Open Admin > Theme, activate one of the seven homepage themes, then customize it.
4. Open Admin > Languages and choose the active language.
5. Open Admin > Payment Gateways and configure real provider credentials before live checkout.
6. Open Admin > Email Templates and SMTP settings before relying on live email delivery.
7. Open Admin > Certificate Templates and verify the certificate preview.
8. Replace demo courses, images, videos, pages, and blog content.
9. Run a low-value provider sandbox/live test before launch.

## 6. Troubleshooting

- Prisma locked on Windows: stop the dev server and rerun the command.
- Wrong redirect domain: check `NEXT_PUBLIC_APP_URL`, `BASE_URL`, Admin Public Site URL, and reverse proxy headers.
- Payment still in demo mode: set `PAYMENT_SANDBOX_MODE=false` and configure provider credentials/webhooks.
- Email not delivered: set `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_FROM`, and provider credentials.
- Uploads work locally but not in production: configure S3/R2/Bunny/Cloudflare Stream and keep `ALLOW_LOCAL_UPLOADS=false`.
- Build fails with upload symlinks: build first, then create symlinks to shared upload folders.
