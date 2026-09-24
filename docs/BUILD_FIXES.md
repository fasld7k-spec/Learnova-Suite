# Build Fixes

## Playwright Example Config
The example Playwright configuration was moved from the project root TypeScript include path into `docs/playwright.config.example.ts.txt` so Next.js type-checking does not require `@playwright/test` unless the buyer chooses to install it.

Production build now remains independent of optional testing dependencies.
