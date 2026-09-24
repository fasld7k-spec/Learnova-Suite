# Add-ons System

Learnova Suite includes a safe add-ons center that lets admins register, upload, configure, activate, and disable add-on manifests from the admin panel. Add-ons are manifest-driven configuration, runtime hook metadata, and webhook contracts; they are not arbitrary runtime plugin bundles.

## Admin Flow

1. Open `/admin/app-marketplace`.
2. Upload a JSON manifest file or paste the manifest JSON.
3. Choose whether to install and activate immediately.
4. Configure the add-on settings from the add-on row.
5. Activate or disable the add-on at any time.
6. If the manifest includes a webhook URL, use **Test webhook** from the row actions to send a signed `addon.test` event.

Uploaded add-ons are stored as metadata and settings. The platform does not execute arbitrary uploaded code at runtime. This is intentional for security and CodeCanyon buyer safety.

## Manifest Format

```json
{
  "slug": "zoom-classroom",
  "name": "Zoom Classroom",
  "version": "1.0.0",
  "description": "Adds Zoom setup fields for live class workflows.",
  "author": "Vendor Name",
  "category": "Live Learning",
  "docsUrl": "https://example.com/docs",
  "adminPath": "/admin/live-sessions",
  "permissions": ["live-sessions:read", "live-sessions:write"],
  "extensionPoints": ["runtime.live-class.booking", "webhook.event.handler"],
  "settings": [
    {
      "key": "apiKey",
      "label": "API Key",
      "type": "password",
      "secret": true,
      "required": true
    },
    {
      "key": "defaultDuration",
      "label": "Default duration",
      "type": "number",
      "defaultValue": 60
    }
  ]
}
```

## Supported Setting Types

- `text`
- `password`
- `textarea`
- `url`
- `number`
- `boolean`
- `select`

Secret fields are encrypted before being saved.

## Signed Webhook Events

External add-ons can react to platform events through signed outbound webhooks. When a manifest includes `webhookUrl`, Learnova Suite sends JSON payloads with:

- `x-learnova-addon`: add-on slug.
- `x-learnova-event`: event name.
- `x-learnova-signature`: HMAC SHA-256 signature when the add-on has a saved `webhookSecret`, `signingSecret`, or `secret`.

Supported event names:

- `addon.test`
- `order.paid`
- `certificate.issued`
- `live-session.created`
- `live-session.updated`
- `live-session.deleted`

## Runtime Hooks and Extension Points

Supported runtime hooks and extension points are:

- `runtime.certificate.rules`: declares certificate settings consumed by certificate templates and issuing workflows.
- `runtime.live-class.booking`: declares live-class settings consumed by availability, booking, preview, and reminder workflows.
- `runtime.affiliate.tracking`: declares affiliate settings consumed by tracking, commission, and payout workflows.
- `email.template.variable`
- `webhook.event.handler`

These hooks are enforced metadata contracts. A manifest can only register the supported hook names listed above; unsupported names are rejected or ignored by the admin registration flow so buyers do not end up with inert capabilities that look active. Uploaded manifests do not inject or execute PHP/JS/Node code at runtime.

If a developer wants an add-on to render new visible UI, they should ship a normal source-code module/page with the item and read the active add-on settings through `lib/addons.ts`. The manifest system safely controls activation, settings, webhooks, and runtime feature gates.

## Built-in Add-ons

The admin panel includes built-in add-on manifests that configure existing platform behavior:

- Advanced Certificates
- Live Class Booking Pack
- Affiliate Growth Kit

These are not standalone runtime plugins. Activating or disabling them changes settings and metadata used by the related certificate, live-class, and affiliate workflows.
