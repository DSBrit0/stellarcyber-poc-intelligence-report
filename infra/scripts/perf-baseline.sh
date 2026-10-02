#!/usr/bin/env bash
# Performance baseline: runs the full Sync collection (production code, no database writes) for the
# given Tenants and records per-phase timings, requests and latency quantiles.
#   INSTANCES="https://a.stellarcyber.cloud|<key>,…" TENANTS="NetUno,Gob de Oaxaca" [STELLAR_CONCURRENCY=16] \
#     infra/scripts/perf-baseline.sh <label>
# Output: /opt/poc-intel/data/files/perf/<date>-<label>.json, plus a summary table on stdout.
set -euo pipefail
cd "$(dirname "$0")/../.."
label=${1:?usage: perf-baseline.sh <label>}
out="/data/perf/$(date +%Y%m%d-%H%M)-${label}.json"
docker compose exec -T -w /app/apps/server \
  -e INSTANCES -e TENANTS -e STELLAR_CONCURRENCY -e TENANT_CONCURRENCY="${TENANT_CONCURRENCY:-1}" -e OUT="$out" \
  worker sh -c 'mkdir -p /data/perf && node dist/cli/validate-instances.js'
echo "saved $out"
