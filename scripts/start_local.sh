#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== WhatsBridge Local Runner ==="

# 1. Check PostgreSQL
if /opt/homebrew/opt/postgresql@17/bin/pg_isready -q; then
    echo "✓ PostgreSQL is active"
else
    echo "Starting PostgreSQL..."
    brew services start postgresql@17 || true
fi

# Ensure database exists
/opt/homebrew/opt/postgresql@17/bin/createdb whatsbridge 2>/dev/null || true

# 2. Python Virtualenv & Migrations
VENV_DIR="/tmp/wb-venv"
if [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "Creating virtualenv at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install -r backend/requirements.txt
fi

export DEBUG=1
export DJANGO_SECRET_KEY="local-dev-secret-key-for-whatsbridge-testing-12345"
export DATABASE_URL="postgres://$(whoami)@localhost:5432/whatsbridge"
export BAILEYS_ENABLED=1
export BAILEYS_URL="http://127.0.0.1:14001"
export BAILEYS_TOKEN="baileys_default_secret_token_1234567890_secure"
export BAILEYS_ENCRYPTION_KEY="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
export BAILEYS_SESSION_DIR="/tmp/baileys-sessions"
export BAILEYS_HOST="127.0.0.1"
export ALLOWED_HOSTS="127.0.0.1,localhost"
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
export CSRF_TRUSTED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
export BACKEND_URL="http://127.0.0.1:8001"

mkdir -p /tmp/baileys-sessions

echo "Applying migrations..."
"$VENV_DIR/bin/python" backend/manage.py migrate --noinput

# 3. Kill existing listeners on our dev ports
kill $(lsof -t -i:14001) 2>/dev/null || true
kill $(lsof -t -i:8001) 2>/dev/null || true
kill $(lsof -t -i:3000) 2>/dev/null || true

# 4. Start Gateway on port 14001
echo "Starting Baileys WhatsApp Gateway on :14001..."
PORT=14001 node gateway/dist/server.js > /tmp/wb-gateway.log 2>&1 &

# 5. Start Django on port 8001
echo "Starting Django API server on :8001..."
"$VENV_DIR/bin/python" backend/manage.py runserver --nothreading 127.0.0.1:8001 > /tmp/wb-backend.log 2>&1 &

# 6. Start Next.js on port 3000
echo "Starting Next.js frontend on :3000..."
cd frontend
npm run dev

