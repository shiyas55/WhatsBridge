# Developer API

Base URL: `http://localhost:8080` in development. HTTPS is required for real deployments.
Interactive OpenAPI: `/api/docs`; raw schema: `/api/schema`; snapshot: `openapi.yaml`.

## Authentication and tenancy

Send `Authorization: Bearer wb_test_...` or `wb_live_...` from your backend. Each key
belongs to one project. Omit `project` for keys; a mismatched supplied project is
rejected. Browser sessions select `?project=UUID` and send `X-CSRFToken` for writes.
Keys cannot manage memberships, issue keys, or administer provider credentials.
The connection create/delete endpoints require an authenticated dashboard session;
`connections:read` keys are intentionally read-only.

Scopes: `messages:send`, `messages:read`, `connections:read`, `otp:send`,
`otp:verify`, `workflows:manage`, `webhooks:manage`.

List endpoints use `count`, `next`, `previous`, `results` with a page size of 50;
use `?page=2`. Message filtering: `status`, `phone`, `direction`. Dashboard tables
currently show the first page. Dates are ISO 8601 with timezone. E.164 phones
include `+` and 8–15 digits. All JSON request bodies must be objects.

## Send a message

`POST /api/v1/messages`, scope `messages:send`, required `Idempotency-Key` header:

```json
{"connection":"UUID","phone":"+15551234567","kind":"text","payload":{"body":"Your order is ready."}}
```

Record contact consent first in the dashboard. Reuse the same key and identical
body after client retries. A conflicting body returns 400. New requests return
202 queued; idempotent repeats return 200. Media types `image`, `document`, `video`,
`audio` accept `{ "link":"https://..." }`, plus optional caption/filename where
supported. The provider fetches media; WhatsBridge does not host uploads.
Templates use `{ "name":"approved_name", "language":"en_US", "components":[] }`.
Optional `scheduled_at` schedules dispatch. Live free-form messages are rejected
outside a recorded inbound 24-hour customer service window; approved templates
are required then. Meta still enforces approval, consent, and messaging policy.

`GET /api/v1/messages` and `GET /api/v1/messages/UUID` require `messages:read`.
OTP payloads are redacted. Accepted is not delivered. Unknown means reconcile
with provider records before taking any further send action.

## OTP

`POST /api/v1/otp/send`, `otp:send`:

```json
{"connection":"UUID","phone":"+15551234567","ttl_seconds":300}
```

Response: `challenge_id`, `expires_at`, `status`. Only sandbox responses also have
`sandbox_code`. Real Meta requests additionally need an operator-approved
`template` and optional `language`. Record OTP-purpose authorization before use.
A resend invalidates previous challenges. OTP Send does not offer idempotent
replay of its secret: use the cooldown and a new challenge after an ambiguous
client response. Do not log the sandbox result or production delivery payload.

`POST /api/v1/otp/verify`, `otp:verify`:

```json
{"challenge_id":"UUID","code":"123456"}
```

Success is `{ "verified":true }`; failed, expired, exhausted or reused challenges
return `400 invalid_challenge`. A correct code cannot be replayed.

## Workflows

Create/list `/api/v1/workflows`; patch/delete `/api/v1/workflows/UUID`.
Publish with `POST /UUID/publish`; pause/resume with `/pause`, `/resume`.
Run with `POST /UUID/run`:

```json
{"context":{"phone":"+15551234567"},"test_mode":true}
```

History: `GET /UUID/history`. Retry an eligible failed node with
`POST /UUID/retry` and `{ "execution":"UUID" }`.
Graph example:

```json
[{"type":"trigger","event":"manual"},{"type":"send_message","connection":"UUID","payload":{"body":"Order confirmed"}},{"type":"wait","seconds":60},{"type":"end"}]
```

## Webhooks

Create/list `/api/v1/webhooks`; delete `/api/v1/webhooks/UUID`.
Body: `{ "url":"https://approved-host.example/events", "events":["message.delivered"] }`.
The platform operator must first add the exact hostname to `WEBHOOK_ALLOWED_HOSTS`.
A signing secret is returned once on creation or `/UUID/rotate`.
`GET /UUID/history` lists delivery attempts; `POST /UUID/retry` with
`{ "delivery":"UUID" }` requeues a dead delivery.

Events: `message.received`, `message.sent`, `message.delivered`, `message.read`,
`message.failed`, `connection.connected`, `connection.disconnected`, `otp.verified`,
`workflow.completed`, `workflow.failed`.

Headers: `X-WhatsBridge-ID`, `X-WhatsBridge-Timestamp`, `X-WhatsBridge-Signature`.
Signature is hex HMAC-SHA256(secret, timestamp + '.' + exact raw body).
See `examples/verify_webhook.py`. Replay storage must be shared and durable in your
receiver; signature verification alone does not prevent replay.

## Error shape

```json
{"error":{"code":"permission_denied","details":"Project unavailable"}}
```

400 validation/invalid challenge/conflicting idempotency data; 401 invalid key;
403 tenant/role/scope/CSRF failure; 404 resource absent from the selected project;
429 throttled with Retry-After. A 500 is an application fault, never success.
Gateway internal responses do not expose provider tokens or raw provider errors.
