#!/usr/bin/env bash
# Creates .env from .env.example with fresh random secrets. Never overwrites an existing .env.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then
  echo ".env already exists; leaving it untouched." >&2
  exit 0
fi

pg_password=$(openssl rand -hex 24)
encryption_key=$(openssl rand -base64 32)

sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pg_password}|" \
  -e "s|^DATABASE_URL=.*|DATABASE_URL=postgres://pocintel:${pg_password}@postgres:5432/pocintel|" \
  -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${encryption_key}|" \
  .env.example > .env
chmod 600 .env
echo ".env created. Back up ENCRYPTION_KEY somewhere safe: losing it invalidates every MFA enrolment."
