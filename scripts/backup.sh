#!/bin/sh
set -eu
umask 077
mkdir -p backups
docker compose exec -T db pg_dump -U whatsbridge -d whatsbridge -Fc > "backups/whatsbridge-$(date -u +%Y%m%dT%H%M%SZ).dump"
printf '%s\n' 'Database backup created. Encrypt and copy it off-host; back up encryption keys and Redis separately.'
