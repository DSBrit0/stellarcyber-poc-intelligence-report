#!/usr/bin/env bash
# Builds and (re)starts the stack on the server. Run from anywhere inside the checkout.
set -euo pipefail
cd "$(dirname "$0")/../.."

mkdir -p "${DATA_ROOT:-/opt/poc-intel/data}"/{postgres,files,caddy}
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
docker compose ps
