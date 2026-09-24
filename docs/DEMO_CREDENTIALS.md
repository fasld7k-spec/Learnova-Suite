# Demo Credentials

Use these credentials for CodeCanyon review, buyer evaluation, and local demo testing.

| Role | URL | Email | Password |
|---|---|---|---|
| Admin | `/login` | `admin@demo.com` | value of `DEMO_PASSWORD` |
| Instructor | `/login` | `instructor@demo.com` | value of `DEMO_PASSWORD` |
| Student | `/login` | `student@demo.com` | value of `DEMO_PASSWORD` |

## Demo Setup

```bash
npm install
npm run demo:setup
npm run demo:doctor
npm run demo:dev
```

Open `http://localhost:3000`.

## Important Notes

- Demo credentials are visible only when `DEMO_MODE=true` is explicitly enabled.
- Do not use demo credentials on production deployments.
- Change all seeded user passwords before using the system with real customers.
- Use `PAYMENT_SANDBOX_MODE=true` only for review, demos, and local testing.
