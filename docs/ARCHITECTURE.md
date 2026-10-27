# Architecture and trust boundaries

Browser → Nginx → Next.js / Django ASGI. All browser API calls use same-origin
HttpOnly Django session cookies plus CSRF tokens. Unauthenticated login/register
also enforce CSRF. Public integrations use project-scoped Bearer keys; key secrets
are SHA-256 hashed with high entropy and never returned after creation/rotation.

Django → PostgreSQL is authoritative. Every customer resource has a project or
organization parent. Querysets filter through membership and project; child
references are validated against the selected project. Roles: owner/admin manage
keys and invitations, developer manages application resources, viewer reads only.
Platform access requires a superuser. A staff flag alone does not unlock the
platform API. Suspensions apply to sessions, keys, workers, and realtime events.

Django/Celery → private Node gateway → Meta Graph API. Credentials are encrypted
with Fernet in ProviderCredential and decrypted only on the server. Browser API
responses never contain stored credentials. The onboarding form accepts initial
credentials; use HTTPS. The gateway uses an independent service token and is not
published by Nginx. Baileys is not a selectable provider.

## Durable jobs

Creating a message atomically validates consent and reserves quota under an
organization row lock, enforcing one `(project, idempotency_key)` record. Beat
polls this durable database outbox and dispatches Celery jobs. Each worker claims a
row with a lock before external I/O. Scheduling is database-backed, not a long
Celery ETA reservation. Attempts are bounded at five. Rate-limit rejections back
off exponentially. A timeout, interrupted process, or ambiguous provider response
becomes `unknown`, never an automatic duplicate send. The Redis gateway claim is
persistent (AOF) and deduplicates repeated internal message IDs. Never flush this
store without reconciling pending provider operations. Gateway claims currently
have no retention TTL; monitor Redis growth.

`queued → processing → accepted → sent → delivered → read` describes distinct
facts. `accepted` means a provider ID was returned, not delivery. Meta signed
callbacks supply delivery/read states. Sandbox emits explicit simulated receipts.
Out-of-order callbacks cannot regress delivered/read states. Failed sends and
unknown outcomes stay available for inspection. Disconnect/revoke erases provider
credentials and prevents future dispatch.

## OTP

Six digits from a cryptographically secure generator; PBKDF2 hash; 60–600 second
TTL; five attempts; one successful use; per-project, phone, and IP counters; 60s
cooldown. The message payload needed for async delivery is separately encrypted
and never shown by message APIs. It is erased after acceptance or expiry.
Sandbox codes are returned once solely in sandbox projects. Real WhatsApp OTP
uses an operator-approved Meta authentication template; no Web-based OTP path.

## Workflow execution

Draft graph → immutable published version → execution snapshot. Supported ordered
nodes: trigger, send message, wait, condition, HTTP request, webhook, AI suggestion,
update contact, admin audit notification, end. A false condition terminates the
linear run. This is not an arbitrary branching graph engine. Published incoming
message triggers create deduplicated executions. Wait/resume is database-backed;
pause prevents the next queued/waiting execution from advancing. Already running
nodes are not forcibly interrupted. Test mode skips waits/external HTTP and
requires sandbox sends. AI calls remain real and budgeted if enabled. Retries are
manual, bounded to three, and disallow uncertain HTTP/webhook/AI side effects.
Message nodes reuse stable idempotency keys. Interrupted runs fail for review.

## Webhooks and egress

Event creation records a delivery outbox with a stable event UUID. Headers carry
that UUID, a timestamp and HMAC-SHA256 over `timestamp.raw_body`. Delivery retries
retain the event ID and generate a fresh signature timestamp. Receivers must
reject old timestamps and persist IDs to reject replays. Endpoint secret rotation
is immediate; coordinate with receivers before rotating.

Only operator-allowlisted HTTPS hosts on port 443 are accepted. Every request
resolves DNS, rejects every private/reserved result, pins the selected public IP
for the socket, verifies TLS against the original hostname, disables redirects,
and ignores ambient proxies. Signed callbacks are verified over exact raw bytes;
Meta callback event keys suppress duplicate processing. There is no unsupported
request-timestamp guarantee for Meta payloads that do not supply one.

## AI and accounting

Gemini is optional, operator-configured, and server-only. Project FAQ context,
enablement and token budget isolate customer prompts. Calls reserve a conservative
budget under a project lock, reconcile provider usage, and always require human
review. No AI output is sent automatically. No vector search or retrieval service
is included. Monthly message reservations and accepted sends are separate counters.
API-key requests are counted. Subscriptions are an accounting model, not a payment
processor. AI budget is currently lifetime per project until an administrator resets it.
