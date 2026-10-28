# Admin Manual

## Initial Setup
- Configure site settings.
- Create categories.
- Configure payment methods.
- Configure currencies and languages.
- Create subscription plans if needed.

## Tax Rates

Configure taxes in **Admin → Tax Rates**. At checkout the buyer's country is taken from a `taxCountry` field if your checkout form sends one, otherwise from the country header added by your CDN (`cf-ipcountry` on Cloudflare, `x-vercel-ip-country` on Vercel, `cloudfront-viewer-country` on CloudFront).

- A rate for a specific country (for example `SA`) applies to buyers from that country.
- A rate with country `*` applies to every buyer whose country has no specific rate, including when the country is unknown.
- If only one rate is configured, it applies to everyone.
- With several country rates and no `*` rate, buyers whose country is unknown pay no tax. Add a `*` rate if that is not what you want.

The country is self-declared or inferred from the IP address, so it is not proof of residence. Check your local tax rules before relying on it.

## Daily Operations
- Review pending instructors.
- Review pending courses.
- Check pending manual payments.
- Monitor withdrawals.
- Moderate reviews/questions.
- Publish blog posts and pages.

## Reports
Use Admin → Reports for revenue, orders, enrollments and reviews summary.
