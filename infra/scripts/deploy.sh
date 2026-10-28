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
# The app services are always recreated: on deploys that changed only some of them, compose left the
# others running their previous, now untagged, images. Postgres is named as a dependency only, so it
# starts if stopped but is never recreated (that takes --always-recreate-deps).
docker compose up -d --remove-orphans --force-recreate api worker web
docker image prune -f >/dev/null
# Build cache older than a week: without this it grows by every build (it had reached 52 GB).
docker builder prune -f --filter until=168h >/dev/null
docker compose ps
