# WhatsBridge

A working multi-tenant messaging application: Django/DRF, PostgreSQL, Next.js/TypeScript,
a Node/TypeScript provider gateway, Redis, Celery/Beat, and Django Channels.

**Current delivery: tested application core and dashboard, not a production-certified or
feature-complete implementation of every item in the master prompt.** Read
[the phase-by-phase status](docs/STATUS.md) before deploying. Sandbox events are
simulated. Live Meta and Gemini functionality requires operator credentials and
provider acceptance testing. Baileys is not installed or exposed.

## Start with Docker

Requirements: Docker Engine/Desktop with Compose v2, Python 3 for secret generation.

```sh
python3 scripts/init_env.py
docker compose up --build -d
docker compose ps
```

Open <http://localhost:8080>. Register, open <http://localhost:8025> (Mailpit),
follow the verification link, and sign in. There are no default accounts or secrets.
Database migrations and static collection run in a one-shot container before the app.

1. Create a **sandbox project**.
2. Add a sandbox connection; it becomes connected immediately.
3. Add a contact using E.164 format, then record messaging and/or OTP consent.
4. Create an API key. Copy its secret once and keep it on your application server.
5. Send a test message. Beat dispatches the database outbox approximately every 10 seconds.
6. Inspect the Inbox, usage totals, and connection status. Sandbox receipts are simulated.
7. Try OTP Send, then verify the returned `sandbox_code` once.
8. Build a workflow, save/publish it, and run with a recipient in `context.phone`.
9. For callbacks, configure `WEBHOOK_ALLOWED_HOSTS` and create an HTTPS endpoint.

For administration:

```sh
docker compose exec backend python manage.py bootstrap_admin
```

Sign in through the dashboard, enable TOTP under Settings, and use Admin or `/admin/`.
Do not publish Mailpit or internal PostgreSQL/Redis/gateway ports.

## Tests and builds

Python 3.13+, Node 24. Dependency lockfiles are included.

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.lock
TESTING=1 python backend/manage.py check
TESTING=1 python backend/manage.py makemigrations --check --dry-run
TESTING=1 pytest backend -q
# Recommended: rerun against your dedicated PostgreSQL test server.
TESTING=1 TEST_DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/whatsbridge_test pytest backend -q
TESTING=1 python backend/manage.py spectacular --validate --fail-on-warn --file docs/openapi.yaml
(cd gateway && npm ci && npm run build && npm test)
(cd frontend && npm ci && npm run build)
```

`TESTING=1` enables SQLite, in-memory cache/channels, and eager Celery tasks.
`TEST_DATABASE_URL` replaces only the database during tests. **Never set TESTING in
staging or production.** SQLite tests do not validate row locks. The PostgreSQL
suite does exercise the PostgreSQL data path; see STATUS for concurrency coverage.

## Repository

```text
backend/       Django API, tenant models, migrations, async jobs, tests
frontend/      Next.js App Router, TypeScript, Tailwind, responsive dashboard
gateway/       Private authenticated Node gateway, sandbox and Meta adapters
experimental/  Explicitly disconnected Baileys research boundary
nginx/         Development proxy and production TLS configuration
scripts/       Environment generation and database backup/restore
docs/          Architecture, API guide, SDK examples, OpenAPI, runbook, status
```

Read [architecture](docs/ARCHITECTURE.md), [API guide](docs/API.md),
[deployment runbook](docs/DEPLOYMENT.md), and [implementation status](docs/STATUS.md).
