# Security Demo

This demo adds content protection controls without requiring object storage or a database migration.

## What is covered

- Admin settings live at `/admin/security` and are stored in the existing `Setting` table under `contentProtection`.
- Lesson video and attachment URLs on `/learn/[slug]` are replaced with expiring `/api/media/access` links when signed URLs are enabled.
- `/api/media/sign` can issue demo links for lesson media and course resources after checking the current user is enrolled, is viewing a preview lesson, or is an admin.
- `/api/media/access` verifies the token, checks the logged-in user again, re-checks lesson/resource enrollment, writes an audit log, and redirects to the protected URL.

## Demo requests

Create a signed lesson video URL:

```http
POST /api/media/sign
Content-Type: application/json

{
  "kind": "lesson-video",
  "lessonId": "LESSON_ID"
}
```

Create a signed course resource URL:

```http
POST /api/media/sign
Content-Type: application/json

{
  "kind": "course-resource",
  "resourceId": "RESOURCE_ID"
}
```

Supported `kind` values are `lesson-video`, `lesson-attachment`, and `course-resource`.

## Production notes

Use a strong `CONTENT_PROTECTION_SECRET` or `JWT_SECRET`, keep private assets in S3/R2/Bunny/Cloudflare Stream, and redirect to provider-native signed URLs instead of public source URLs.
