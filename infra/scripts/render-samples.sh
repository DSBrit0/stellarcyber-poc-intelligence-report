#!/usr/bin/env bash
# Renders every Template (HTML + PDF, with the production Chromium) from live data, for visual review.
#   STELLAR_URL=https://x.stellarcyber.cloud STELLAR_API_KEY=… STELLAR_TENANT=<cust_id> [AI_TRIAGE=1] [LOCALES=pt-BR] \
#     infra/scripts/render-samples.sh <name>
# Output: /opt/poc-intel/data/files/samples/<name>/ (report-data.json is cached; delete it to collect again).
set -euo pipefail
cd "$(dirname "$0")/../.."
name=${1:?usage: render-samples.sh <name>}
docker compose exec -T -w /app/apps/server \
  -e STELLAR_URL -e STELLAR_API_KEY -e STELLAR_TENANT -e AI_TRIAGE -e LOCALES="${LOCALES:-pt-BR}" \
  -e OUT_DIR="/data/samples/$name" -e PDF=1 \
  worker node dist/cli/render-sample.js
ls -la "${DATA_ROOT:-/opt/poc-intel/data}/files/samples/$name"
