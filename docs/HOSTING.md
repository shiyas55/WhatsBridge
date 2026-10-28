# Vercel + Render: QR recovery

## What was checked

The Vercel homepage, Vercel `/api/auth/session` proxy, Render `/api/auth/session`, backend `/health`, and QR gateway `/health` all returned HTTP 200. Unauthenticated requests to the QR session endpoint returned 401. This establishes basic routing, not authenticated QR success.

The previous repository Blueprint supplied `BAILEYS_URL` from Render's `host` property (a private hostname without a port). The backend added `https://`, although the connector listens on HTTP port 10000. The corrected configuration uses `hostport` and normalizes a scheme-less private address to HTTP. See https://render.com/docs/blueprint-spec#supported-properties.

## Apply the QR fix to existing services

On Render **whatsbridge-backend → Environment**:

```dotenv
BAILEYS_ENABLED=1
BAILEYS_URL=https://whatsbridge-gateway.onrender.com
PUBLIC_URL=https://whats-bridge.vercel.app
CSRF_TRUSTED_ORIGINS=https://whats-bridge.vercel.app,https://whatsbridge-backend.onrender.com
```

The public HTTPS URL above is an immediate routing option for the existing services. With the updated paid/private-network Blueprint, use its automatic private `hostport` reference instead. Do not prepend HTTPS to a Render private hostname.

Set `BAILEYS_TOKEN` to the exact same private token on backend and QR gateway. Do not copy secrets into chat or frontend variables. Do not point the official `GATEWAY_URL` at the QR gateway.

On Render **whatsbridge-gateway → Settings / Environment**:

- Root directory: `experimental/baileys` within this application repository (adjust the prefix if deploying a monorepo).
- Build: `npm ci && npm run build`; start: `npm start`.
- `BAILEYS_HOST=0.0.0.0`; use Render's assigned `PORT` (the Blueprint uses 10000).
- `BAILEYS_ENCRYPTION_KEY`: a private base64-encoded 32-byte key. The corrected connector fails closed without it. Preserve the existing private key for existing encrypted sessions; replacing it requires a planned session migration/re-pair. The old checked-in default key must not be reused for new sessions.
- `BAILEYS_SESSION_DIR=/var/data/whatsbridge/sessions` only after mounting a persistent disk at `/var/data/whatsbridge`. Without a disk, sessions are temporary and users must re-pair after restarts.

Redeploy the matching backend and QR service source together. A successful `/health` alone does not prove that both versions agree on `/sessions/{organization}/{project}/{connection}/pair` and the status endpoint.

Vercel root directory: `frontend`. Set `BACKEND_URL=https://whatsbridge-backend.onrender.com` for Production and redeploy; Next.js rewrites are generated during the build. Keep browser requests on `/api/...` so session and CSRF cookies remain on the frontend origin. The frontend now polls status if its WebSocket route is unavailable.

Then open Connections → Show QR / status → Retry Pairing. In browser Network, inspect the POST `/pair` and GET `/qr` responses:

- `PAIRING` with a `data:image/png...` QR: rendering/scan stage reached.
- 401 from the connector: private service tokens do not match.
- 404: wrong service or incompatible deployed connector version.
- unavailable/timeout: wrong URL, wrong port, sleeping service, or connector startup failure.
- `CONNECTED`: phone pairing completed. A real message must still be verified separately.

## Complete hosting topology

The revised `render.yaml` is a **reviewable paid topology**, not an already-applied deployment. It adds Redis, Celery worker and Beat, persistent QR storage, and an independent official Meta gateway in `providers/meta`. Existing legacy `gateway/` source has been preserved. Syncing this Blueprint provisions paid services and a disk; review billing before applying it.

Provide existing `DATABASE_URL`, a valid Fernet `CREDENTIAL_KEY`, SMTP credentials/from address, a supported `META_GRAPH_VERSION`, and vetted `OTP_TEMPLATE_NAMES`. New `sync: false` settings must be entered manually for existing Render services. Do not regenerate credential encryption keys without a migration plan. PostgreSQL URL TLS options now remain intact.

For initial QR troubleshooting, apply the small environment/service-root fix above first. Redis/worker/Beat are required for the complete queued messaging workflow but are not needed merely to generate a QR.

## Verification performed locally

- 43 backend tests, including private service URL and PostgreSQL TLS configuration.
- 6 official provider adapter tests; official gateway TypeScript build.
- Frontend production build with the live backend URL.
- Render Blueprint validation against Render's published JSON schema.

Live environment updates, authenticated live QR generation, phone linking and real delivery remain unverified. Production OTP stays on the official Meta authentication-template path.
