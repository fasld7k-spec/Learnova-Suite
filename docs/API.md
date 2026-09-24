# API Endpoints
Web Auth: POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`.
Courses: GET `/api/courses`, POST `/api/courses`.
Checkout: POST `/api/checkout`.
Live Sessions: GET `/api/live-sessions`, POST `/api/live-sessions`.
Certificates: GET `/api/certificates/verify/:code`.
Admin: GET `/api/admin/stats`.
Production webhook foundations: Stripe and PayPal webhooks verify signatures and validate order amount, currency, and stored payment session identifiers before marking orders as paid. Manual payment approval is handled from the admin panel.

## Mobile API Integration

The Flutter app is designed to connect to the same buyer website backend. Set the website domain in the mobile build using:

```bash
--dart-define=LEARNOVA_API_BASE_URL=https://your-domain.com
--dart-define=LEARNOVA_USE_MOCK=false
--dart-define=LEARNOVA_ENABLE_NETWORK_FALLBACK=false
```

Mobile-compatible endpoints are centralized in the web project by `lib/mobile-app-api-manifest.ts` and exposed through `/api/mobile-app`. Supported roles are `student` and `teacher`.

Primary mobile endpoint groups:

- Auth/session: `/api/mobile-app/auth/login`, `/api/mobile-app/auth/register`, `/api/mobile-app/auth/role`, `/api/mobile-app/auth/forgot-password`.
- Student learning: `/api/mobile-app/courses`, `/api/mobile-app/courses/:id`, `/api/mobile-app/courses/:id/enroll`, `/api/mobile-app/learning/progress`, `/api/mobile-app/learning/bookmarks`, `/api/mobile-app/learning/achievements`, `/api/mobile-app/learning/certificates`.
- Lessons, quizzes and assignments: `/api/mobile-app/lessons/:id`, `/api/mobile-app/lessons/:id/bookmark`, `/api/mobile-app/quizzes/:id/attempts`, `/api/mobile-app/assignments/:id/submissions`.
- Community and messages: `/api/mobile-app/community/posts`, `/api/mobile-app/community/posts/:id/like`, `/api/mobile-app/community/posts/:id/replies`, `/api/mobile-app/chat/conversations`, `/api/mobile-app/chat/messages`, `/api/mobile-app/notifications`.
- Teacher tools: `/api/mobile-app/teacher/metrics`, `/api/mobile-app/teacher/courses`, `/api/mobile-app/teacher/courses/:id`, `/api/mobile-app/teacher/students`, `/api/mobile-app/teacher/live-sessions`, `/api/mobile-app/teacher/payout-methods`, `/api/mobile-app/teacher/withdrawals`, `/api/mobile-app/teacher/submissions`.

Keep the web and mobile packages on the same release version so route contracts, role guards, and response shapes stay aligned.
