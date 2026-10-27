#!/usr/bin/env python3
import base64, secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / ".env"
if path.exists():
    raise SystemExit(".env already exists; refusing to overwrite secrets")
text = (root / ".env.example").read_text()
values = {
    "replace-with-a-random-64-character-secret": secrets.token_urlsafe(48),
    "replace-with-a-Fernet-key": base64.urlsafe_b64encode(
        secrets.token_bytes(32)
    ).decode(),
    "replace-with-a-random-32-character-or-longer-token": secrets.token_urlsafe(32),
    "replace-with-a-random-database-password": secrets.token_hex(24),
}
for old, new in values.items():
    text = text.replace(old, new)
path.write_text(text)
path.chmod(0o600)
print("Created .env with unique development secrets. No credentials were printed.")
