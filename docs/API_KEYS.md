# API Keys

Admin can generate API keys from Admin → API Keys.

Public integration example:
```bash
curl -H "x-api-key: emp_xxx" http://localhost:3000/api/public/courses
```

Only hashed API keys are stored in the database.
