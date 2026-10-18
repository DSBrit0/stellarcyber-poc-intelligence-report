#!/usr/bin/env bash
# Daily logical backup of PostgreSQL, keeping the newest BACKUP_KEEP dumps (default 2: the last two
# days; copies are kept on this server only).
# Installed in cron by install-cron.sh. Restore: pg_restore --clean -d pocintel <file>.
set -euo pipefail
cd "$(dirname "$0")/../.."

dest=${BACKUP_DIR:-/opt/poc-intel/backups}
keep=${BACKUP_KEEP:-2}
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "$dest"

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$dest/pocintel-$stamp.dump.partial"
mv "$dest/pocintel-$stamp.dump.partial" "$dest/pocintel-$stamp.dump"
chmod 600 "$dest/pocintel-$stamp.dump"

ls -1t "$dest"/pocintel-*.dump | tail -n +"$((keep + 1))" | xargs -r rm --
echo "backup: $dest/pocintel-$stamp.dump"
