# Experimental OTP through your linked WhatsApp

Implemented within WhatsBridge: Django owns tenant authorization, OTP storage and verification; the isolated Node/Baileys connector owns QR pairing and the WhatsApp socket. This avoids a second unscoped OTP service and preserves existing project API keys.

This is an explicit research opt-in. Delivery can fail or be delayed. Production authentication should use the official Meta adapter with an approved authentication template and an appropriate fallback channel. Queued/accepted does not mean delivered.

## Enable

Set these on **both the Django backend and Celery worker**, then restart them:

```dotenv
BAILEYS_ENABLED=1
BAILEYS_OTP_ENABLED=1
```

Configure the matching private gateway URL/token, encrypted session directory and encryption key as described in HOSTING.md. These flags alone do not repair an old gateway deployment or its 404 response. Deploy the matching connector too.

Use a live project. Its administrator pairs the phone from Connections → Show QR. Credentials are saved as tenant-bound encrypted `.enc` files, not plaintext `creds.json`. On Node restart, stored paired credentials are loaded automatically. Logged-out/unpaired records are not automatically paired. A revoked, expired or invalid session needs owner intervention; no infinite reconnect loop is used. Preserve the disk and encryption key across deployments.

## Send an OTP from your application's server

Record the customer's actual OTP consent before sending. Give the integration key `otp:send` and `otp:verify` scopes. Do not expose that key to checkout JavaScript. Require a full international number: `+919876543210`, not an ambiguous local number.

```sh
curl "$BASE_URL/api/v1/otp/send" \
  -H "Authorization: Bearer $WHATSBRIDGE_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"connection":"CONNECTION_UUID","phone":"+919876543210"}'
```

Returns HTTP 202 with `challenge_id`, `expires_at`, `status: queued`, `experimental: true` and `delivery_guaranteed: false`. Real OTP codes are never returned by this endpoint. Default expiry is 300 seconds. The caller may select 60–600 seconds with `ttl_seconds`.

The code is cryptographically generated, hashed for verification, and encrypted in the queued transport payload. The worker sends it as a text message to the international-number WhatsApp JID. The job checks expiry, consent and the opt-in flag again before dispatch. Resending invalidates older challenges; pending expired challenges are not sent.

## Verify from your application's server

Keep the returned challenge ID bound to the original checkout session and intended phone. Do not let a customer replace that binding with another customer's challenge.

```sh
curl "$BASE_URL/api/v1/otp/verify" \
  -H "Authorization: Bearer $WHATSBRIDGE_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"challenge_id":"CHALLENGE_UUID","code":"582914"}'
```

A successful response includes `verified: true`, a signed `verification_token`, `token_type: phone_verification`, and `expires_in: 300`. Your server can then establish its own customer session after checking its checkout binding. This token is **not a WhatsBridge dashboard login token**. The verifier accepts a code once and locks after five failed attempts. Project/IP/phone limits and resend cooldowns remain enforced.

The proof is a Django timestamped signature, not a JWT. A trusted verifier in this backend can use `django.core.signing.loads(token, salt='whatsbridge-phone-verification-v1', max_age=300)`. It must check `purpose`, expected `project`, `phone` and `challenge`, reject `simulated: true` for real authentication, and consume the challenge identifier once in its own session issuance transaction. Never share DJANGO_SECRET_KEY with checkout clients or unrelated integrations. Prefer the authenticated server-to-server verify response for external integrations.

## Existing tenant-scoped pairing endpoints

- `POST /api/v1/connections/{id}/pair?project={project}`
- `GET /api/v1/connections/{id}/qr?project={project}`

Pairing is restricted to an administrator's browser session. There is deliberately no public unscoped `/whatsapp/qr` endpoint that could expose another tenant's login QR.

## Validation limits

Automated tests cover opt-in gating, encrypted queued OTP, hashing, default expiry, single-use verification, attempt limits, tenant isolation, disabled-before-dispatch checks and paired credential persistence. Network delivery in the new OTP test is mocked. A real phone scan and an authorized test recipient are still required for end-to-end delivery verification. These changes have not been deployed or enabled on the live service.
