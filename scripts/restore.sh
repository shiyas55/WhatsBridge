#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo 'Usage: scripts/restore.sh backup.dump (restore into an EMPTY database)'; exit 1; fi
docker compose exec -T db pg_restore -U whatsbridge -d whatsbridge --exit-on-error < "$1"
