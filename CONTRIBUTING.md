# Contributing

Thank you for helping improve Learnova Suite! Bug reports, fixes, translations, documentation and new features are all welcome.

## Getting started

1. Fork the repository and create a branch from `main` (for example `fix/checkout-coupon`).
2. Set up the local demo as described in the [README](README.md#quick-start-local-demo).
3. Make your change, keeping the code typed and consistent with the surrounding style.

## Before opening a pull request

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

- Update the documentation in `docs/` when you add or change a feature.
- Add new UI strings to every language dictionary in `lib/` and run `npm run localization:check`.
- Keep pull requests focused on one change and describe what you changed and why.

## Architecture rules

- Keep role checks on every protected route and API handler.
- Validate input (with Zod) before writing to the database.
- Store secrets only in environment variables — never commit `.env` files or real keys.

## Reporting bugs

Open an issue with steps to reproduce, the expected and actual behavior, and whether it happens in demo mode, production mode or both. For security vulnerabilities, see [SECURITY.md](SECURITY.md) instead of opening a public issue.

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
