# Isolated experimental WhatsApp QR connector

This opt-in service implements QR pairing, encrypted per-tenant linked-device sessions, consented outbound text messages, and outbound delivery receipts. It is separate from the official Meta provider gateway. Production OTP remains on approved Meta authentication templates. There is no WhatsApp-Web-based production OTP guarantee.

Install with `npm ci`, build with `npm run build`, then run `npm start`. Configure:

- `BAILEYS_TOKEN`: unique random private service credential, at least 32 characters.
- `BAILEYS_ENCRYPTION_KEY`: base64 encoding of 32 random bytes; retain securely across restarts.
- `BAILEYS_SESSION_DIR`: persistent private session directory.
- `PORT`: default 14001. Listener defaults to loopback. Container operators may explicitly set `BAILEYS_HOST` on a private network.

Configure Django with `BAILEYS_ENABLED=1`, the matching `BAILEYS_TOKEN`, and `BAILEYS_URL` pointing at this private service. Defaults are disabled; no public shared gateway or fallback credential is used. Never expose this service or its token to browser clients. Only Django authorizes tenant administrators and proxies QR operations.

Sessions use AES-256-GCM and tenant-bound authenticated metadata. Sends are deduplicated with persisted claims; uncertain outcomes require inspection, not blind resend. Reconnection is explicit except for one protocol-required post-pairing restart. QR payloads are short-lived credentials and must not be logged or cached.

See [setup and API guide](../../docs/QR-SETUP.md). Real phone pairing and delivery still require user verification; automated tests do not establish production reliability.
