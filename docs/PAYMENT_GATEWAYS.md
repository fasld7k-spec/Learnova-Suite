# Payment Gateways

Learnova Suite includes a multi-gateway payment architecture for local evaluation and production extension.

## Supported Foundations
Stripe, PayPal, Razorpay, Paystack, Flutterwave, Mollie, Iyzico, Paymob, Tap Payments, HyperPay, Midtrans, Xendit, SSLCommerz, Manual/Bank Transfer, COD, and Free checkout.

## Admin Setup
Go to **Admin -> Payment Gateways** and configure provider JSON. Webhook URLs follow `/api/webhooks/{gateway}`.

Native live redirect checkout is implemented for Stripe Checkout, PayPal Orders, Razorpay, Paystack, Flutterwave, Mollie, Paymob, Tap Payments, Midtrans, Xendit, and SSLCommerz. Iyzico and HyperPay adapters are included but return inline/provider-specific sessions, so production checkout should use a hosted checkout URL in Admin -> Payment Gateways or a custom inline checkout surface for those two providers.

## Local Evaluation Behavior
With `PAYMENT_SANDBOX_MODE=true`, checkout uses sandbox-safe screens and mock references so buyers can test the flow without external accounts. Keep this mode disabled on live stores that accept real money. If you deploy a production-built public preview, set `ALLOW_PRODUCTION_DEMO_PAYMENTS=true` intentionally; otherwise mock payment confirmation remains blocked in production.

## Production Payment Guard
Before any live deployment, set `PAYMENT_SANDBOX_MODE=false`, `ALLOW_PRODUCTION_DEMO_PAYMENTS=false`, and configure a real provider key/webhook pair. Mock checkout is only for local evaluation and must not be enabled in production storefronts.

Sandbox/mock checkout does not verify production credentials and does not create recurring gateway subscriptions. Subscription plans in the default flow are membership access periods purchased through a one-time order; add a provider-specific recurring billing integration before advertising them as automatic recurring billing.

## Production Note
This implementation includes gateway abstraction, idempotent order finalization, database-backed webhook idempotency by provider/event ID, order/payment state handling, offline payment references, mock checkout screens, native redirect checkout sessions, Stripe Checkout Session foundations, PayPal Orders API foundations, provider webhook verification, Stripe/PayPal amount/currency/session validation, and generic signed webhook processing for extension providers.

For live Stripe, set `PAYMENT_SANDBOX_MODE=false`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`, then verify amount/currency/session behavior in the provider sandbox.
For live PayPal, set `PAYMENT_SANDBOX_MODE=false`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and `PAYPAL_MODE=live`, then run provider sandbox QA before launch.
For live Razorpay, Paystack, Flutterwave, Mollie, Paymob, Tap, Midtrans, Xendit, or SSLCommerz, set the required provider keys from `.env.production.example`; their redirect adapter sessions are wired into checkout. For Iyzico and HyperPay, add a Hosted Checkout URL in Admin -> Payment Gateways until you add the matching inline checkout surface.

## Refund Handling
Admin refund approval now attempts an automated provider refund when the gateway has a refund adapter and the payment record has a provider transaction ID. If the gateway is manual/offline, lacks refund support, or has no provider transaction ID, the refund is recorded as manual/offline in payment metadata and audit logs instead of being presented as a provider refund. Provider refund failures stop the approval so the order is not marked refunded before the external refund succeeds.
