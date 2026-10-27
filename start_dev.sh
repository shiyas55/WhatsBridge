#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# 1. Initialize environment if not present
if [ ! -f .env ]; then
    python3 scripts/init_env.py
fi

# 2. Activate Python virtualenv
if [ -d .venv ]; then
    source .venv/bin/activate
fi

# 3. Apply any migrations
python backend/manage.py migrate --noinput

# 4. Start backend on port 8001
echo "Starting WhatsBridge Backend on http://127.0.0.1:8001..."
DEBUG=1 DJANGO_SECRET_KEY="dev-secret-key-whatsbridge-runner-test" python backend/manage.py runserver 127.0.0.1:8001 &
BACKEND_PID=$!

# 5. Start frontend on port 3000
echo "Starting WhatsBridge Frontend Dashboard on http://localhost:3000..."
BACKEND_URL=http://127.0.0.1:8001 npm --prefix frontend run dev -- -p 3000 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT INT TERM

wait
