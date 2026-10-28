  # Account → project → QR → API

  The corrected local app is running at http://localhost:3002. Older tabs on ports 3000/3001 use earlier development processes. Local mode uses SQLite and a local task dispatcher; this is not the PostgreSQL/Redis production deployment.

  1. Register an account, verify its email and sign in. This local run saves verification email in `work/runtime/qr-fixed/mail/` at the workspace root. Open the verification URL from that file. No email is delivered externally in local mode. Configure a working SMTP provider for deployed customers.
  2. Create a project with **Live · Meta or experimental QR**, then open **Connections → Add connection → Experimental WhatsApp · QR linking**. Saving opens the QR popup. Alternatively, **Link my WhatsApp · QR** creates a live project when the current project is sandbox.
  3. On your phone, open WhatsApp → Settings (or ⋮) → Linked devices → Link a device. Scan the live QR in the popup. Wait for **CONNECTED**. Expired codes refresh automatically while pairing; use Retry Pairing after a disconnect.
  4. Add the intended recipient under Contacts, then record their actual messaging consent. The application does not invent consent automatically.
  5. Create a project API key with `messages:send` and optionally `messages:read`. Copy the secret once to your application's server. Do not put it in public frontend code.
  6. Use the connection ID shown in Connections:

  ```sh
  curl 'http://localhost:3002/api/v1/messages' \
    -H "Authorization: Bearer $WHATSBRIDGE_API_KEY" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: my-first-message-001' \
    --data '{"connection":"CONNECTION_UUID","phone":"+COUNTRYCODE_NUMBER","kind":"text","payload":{"body":"Your requested test message"}}'
  ```

  The key determines the project. A queued/accepted result is not proof of delivery: inspect the message status or signed webhook receipts. Retry the same logical send using the same idempotency key. Experimental ambiguous outcomes are not automatically resent.

  ## OTP

  QR linking is experimental and only supports consented text messages. It has no supported production OTP path. For OTP using your business number, create an **Official Meta Cloud API** connection, onboard your own Meta credentials, and use an approved authentication template configured in `OTP_TEMPLATE_NAMES`. Sandbox OTP is simulated. Do not use the QR connector as a guaranteed authentication delivery service.

  ## Verified this revision

  - New account registration, email verification, login, live project and connection creation against the running HTTP application.
  - Real WhatsApp pairing QR generated as a PNG data URL; explicit disconnect succeeded.
  - Backend automated suite: 39 tests; encrypted session storage: 2 tests; Next.js production build.
  - Invalid gateway Bearer credentials rejected. QR is session/admin-only and unavailable to project API keys.
  - API-key-authenticated sandbox send traversed the local worker and reached simulated `delivered`.
  - No phone has been linked during this test; no real message or real OTP delivery was tested.
  - Browser automation was unavailable, so visual QR rendering has not been independently verified in this revision.
