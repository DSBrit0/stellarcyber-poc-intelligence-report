#!/usr/bin/env bash
# Installs the daily backup (02:30) in the current user's crontab. Idempotent.
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/backup.sh"
line="30 2 * * * $script >> /opt/poc-intel/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "$script" || true; echo "$line" ) | crontab -
crontab -l | grep -F "$script"
