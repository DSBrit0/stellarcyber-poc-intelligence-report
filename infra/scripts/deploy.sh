#!/usr/bin/env bash
# Updates the checkout from GitHub, then builds and (re)starts the stack on the server.
# Run from anywhere inside the checkout. SKIP_PULL=1 deploys the working tree as is.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ "${SKIP_PULL:-0}" != 1 ]]; then
  git pull --ff-only
fi
echo "deploying $(git log -1 --format='%h %s')"

mkdir -p "${DATA_ROOT:-/opt/poc-intel/data}"/{postgres,files,caddy}
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
docker compose ps
