# Run And Deploy Steps

This file explains exactly how to run Learnova locally, deploy it to a production server, configure the required services, and verify the installation.

## 1. Requirements

### Local Demo Requirements

- Node.js 20 or newer.
- npm 10 or newer.
- Windows, Linux or macOS.
- Internet connection for installing npm packages.

### Production Server Requirements

- VPS or Node.js hosting provider.
- Node.js 20 or newer.
- npm 10 or newer.
- PostgreSQL 14 or newer.
- A domain pointed to the server.
- HTTPS/SSL certificate.
- SMTP or SMTP-compatible transactional email provider.
- Real payment provider credentials if you will accept live payments.
- External storage for production files and videos, such as S3, Cloudflare R2, Bunny, Cloudflare Stream or DigitalOcean Spaces.

## 2. Run The Website Locally In Demo Mode

Demo mode is intended for local testing and evaluation.

Clone the repository (`git clone https://github.com/fasld7k-spec/Learnova-Suite.git`), then open a terminal in the project folder.

Open a terminal in the project folder and run:

```bash
npm install
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Then open:

```text
http://localhost:3000
```

## 3. Demo Login Accounts

```text
Admin:
admin@demo.com
value of DEMO_PASSWORD

Instructor:
instructor@demo.com
value of DEMO_PASSWORD

Student:
student@demo.com
value of DEMO_PASSWORD
```

## 4. Verify The Local Demo

After the local server is running, open a second terminal and run:

```bash
npm run demo:smoke
```

To check database and demo settings:

```bash
npm run demo:doctor
```

## 5. Production Server Installation

Production mode must use PostgreSQL. The included SQLite database is only for demo/review workflows.

### Step 1: Create The Production Environment File

Copy the production example:

```bash
cp .env.production.example .env
```

Then edit `.env`.

Important values:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace-with-a-strong-random-secret
SETTINGS_ENCRYPTION_KEY=replace-with-a-strong-random-secret
TOTP_ENCRYPTION_KEY=replace-with-exactly-32-utf8-bytes-or-64-hex-characters
CONTENT_PROTECTION_SECRET=replace-with-a-strong-random-secret
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

Important:

- Do not use demo credentials in production.
- Do not publish or commit your `.env` file.
- Use strong unique secrets.
- Use PostgreSQL for production.

### Step 2: Install Packages

```bash
npm install
```

### Step 3: Check Production Readiness

```bash
npm run production:preflight
```

If the command prints `REVIEW`, that item needs configuration before launch.

Recommended live-launch items include PostgreSQL, strong secrets, `DEMO_MODE=false`, `PAYMENT_SANDBOX_MODE=false`, SMTP, HTTPS, external storage, real payment credentials and provider webhooks.

### Step 4: Generate Prisma Client And Run Migrations

```bash
npm run prisma:generate:postgres
npm run prisma:push:postgres
```

### Step 5: Build The Project

```bash
npm run build:postgres
```

If you use local persistent upload folders on a VPS, keep `public/uploads` and `storage/protected-uploads` as normal folders while running `next build`. Create any symlinks to shared upload folders only after the build has finished. Turbopack can fail when a public folder symlink points outside the project root during build.

Example release-flow order:

```bash
npm run build:postgres
rm -rf public/uploads storage/protected-uploads
mkdir -p /var/www/learnova/shared/uploads /var/www/learnova/shared/protected-uploads storage
ln -s /var/www/learnova/shared/uploads public/uploads
ln -s /var/www/learnova/shared/protected-uploads storage/protected-uploads
```

### Step 6: Start The Project

```bash
npm run start
```

## 6. Run With PM2

PM2 is recommended on a VPS to keep the app running.

Install PM2:

```bash
npm install -g pm2
```

Start the app:

```bash
pm2 start npm --name learnova -- run start
pm2 save
```

Check status:

```bash
pm2 status
```

View logs:

```bash
pm2 logs learnova
```

Restart:

```bash
pm2 restart learnova
```

## 7. Nginx Reverse Proxy Example

Example Nginx configuration:

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

After saving the Nginx file:

```bash
nginx -t
systemctl reload nginx
```

## 8. Enable HTTPS

If you use Certbot:

```bash
certbot --nginx -d your-domain.com
```

After SSL is enabled, confirm the website works at:

```text
https://your-domain.com
```

## 9. Admin Setup After Deployment

After logging in as Admin:

1. Open Admin > Settings.
2. Set site name, support email and support phone.
3. Set the default currency.
4. Set the public site URL.
5. Open Admin > Theme and choose a homepage theme.
6. Click Customize to edit the selected theme.
7. Open Admin > Languages and choose the active language.
8. Open Admin > Payment Gateways and configure live payment providers.
9. Open Admin > Email Templates and configure email content.
10. Open Admin > Certificate Templates and configure certificate design.
11. Open Admin > App Marketplace and enable the add-ons you need.
12. Replace or remove sample content before launch.

## 10. Instructor Setup

Instructors can:

- Create courses.
- Upload course cover images.
- Add modules.
- Add lessons.
- Add video, text or file resources.
- Mark selected lessons as free preview.
- Create coupons for their courses.
- Manage live sessions.
- Edit availability schedule.
- Review students and analytics.

## 11. Payment Setup

Before accepting real payments:

- Set `PAYMENT_SANDBOX_MODE=false`.
- Add real payment provider credentials.
- Configure provider webhooks.
- Test the provider sandbox.
- Run a real low-value payment test if possible.

Note:

The included payment screens are demo/sandbox foundations. Do not use them for live payments until provider credentials and webhooks are configured correctly.

## 12. Email Setup

Before production, configure SMTP:

```text
EMAIL_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Test these flows:

- Account registration.
- Password reset.
- Purchase notification.
- Certificate notification.
- Support reply.

## 13. Uploads And Video Storage

Local storage is suitable for demos only.

For production, use:

- Amazon S3.
- Cloudflare R2.
- Bunny Stream.
- Cloudflare Stream.
- DigitalOcean Spaces.

Paid videos and protected files should be served through private or temporary access URLs.

Recommended environment keys for external storage:

```text
STORAGE_PROVIDER=s3
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
MEDIA_ALLOWED_HOSTS=your-cdn-host.com
```

For Bunny Stream, configure all Bunny keys together and add the Bunny CDN/iframe hostnames to `MEDIA_ALLOWED_HOSTS`.

## 14. Important Verification Commands

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

## 15. Common Issues

### Prisma fails on Windows

Stop the running dev server, then run the command again.

### The website redirects to the wrong domain

Check:

- `NEXT_PUBLIC_APP_URL`
- `BASE_URL`
- Public site URL in Admin settings.
- Nginx `Host` and `X-Forwarded-Proto` headers.

### Payment is still in demo mode

Check:

```text
PAYMENT_SANDBOX_MODE=false
```

Then confirm real provider credentials are configured.

### Emails are not delivered

Check SMTP settings and confirm:

```text
EMAIL_PROVIDER=smtp
```

Also verify `SMTP_FROM`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_STARTTLS`, provider firewall rules and whether your provider requires a verified sender domain.

### File uploads fail in production

Check:

- `ALLOW_LOCAL_UPLOADS=false` for production.
- External storage credentials are configured.
- The bucket exists and is writable.
- `MEDIA_ALLOWED_HOSTS` includes the CDN/video domain.
- `client_max_body_size` is high enough in Nginx.

### Admin changes are not reflected on the public site

Clear the platform cache from Admin > Cache, then restart the process manager if server-level cache is enabled.

### Course videos are not protected enough

Use a production video/storage provider that supports private access, token authentication or temporary signed URLs.

## 16. Before Launch Checklist

Review this list before going live:

- Demo login credentials changed.
- sample content replaced or removed.
- PostgreSQL configured.
- HTTPS configured.
- SMTP configured.
- Payment gateways configured.
- Payment webhooks configured.
- External storage configured.
- Public site URL configured.
- Homepage theme selected and customized.
- Certificates configured.
- Language and currency configured.
- Login tested.
- Course purchase tested.
- Lesson playback tested.
- Certificate generation tested.
- `npm run production:preflight` reviewed.

## 17. Important Production Notes

- Do not store credit card details in the app.
- Do not run production with demo mode enabled.
- Do not use SQLite for production.
- Do not use local storage for paid production videos.
- Do not publish `.env`.
- Keep regular database backups.

