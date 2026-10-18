#!/usr/bin/env bash
# Proves the newest backup restores: loads it into a throwaway database next to the real one, compares
# the row counts of the main tables, then drops the copy. The real database is only read.
set -euo pipefail
cd "$(dirname "$0")/../.."

dest=${BACKUP_DIR:-/opt/poc-intel/backups}
dump=$(ls -1t "$dest"/pocintel-*.dump | head -n 1)
scratch=pocintel_restore_test
echo "restoring: $dump"

psql() { docker compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d $1 -tAq -c \"$2\""; }
docker compose exec -T postgres sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists $scratch && createdb -U \"\$POSTGRES_USER\" $scratch"
trap 'docker compose exec -T postgres sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists '"$scratch"'" >/dev/null' EXIT
docker compose exec -T postgres sh -c "pg_restore -U \"\$POSTGRES_USER\" -d $scratch --no-owner --exit-on-error" < "$dump"

fail=0
for table in users customers pocs report_data syncs catalog_entries catalog_updates experiences audit_log schema_migrations; do
  live=$(psql '"$POSTGRES_DB"' "select count(*) from $table")
  copy=$(psql $scratch "select count(*) from $table")
  mark=ok
  # The live tables may have grown since the dump (logs, audit): the copy must not have more rows.
  if [ "$copy" -gt "$live" ]; then mark=MISMATCH; fail=1; fi
  printf '%-20s live=%-8s restored=%-8s %s\n' "$table" "$live" "$copy" "$mark"
done
[ "$fail" = 0 ] && echo "restore test: OK" || { echo "restore test: FAILED"; exit 1; }
