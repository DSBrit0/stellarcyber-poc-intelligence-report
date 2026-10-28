# Runbook

What to do when production breaks, and how far back a recovery goes. Access to the server is in [server-access.md](server-access.md). No secrets live here.

## Recovery targets

| | Target | Why |
|---|---|---|
| RPO (data that can be lost) | 24 h | One logical dump a day at 02:30 (`backup.sh`, cron). Work done after the last dump is lost if the database is. |
| RTO (time to be back) | 1 h on the same server; half a day on a new one | Restoring a dump takes minutes at the current size. A new server also needs Docker, the checkout and the `.env`. |
| Copies kept | 2 dumps, on the server only | Decided 2026-10-18: no offsite copy. A lost disk loses the database and both dumps. |
| Copy off the server | By hand | Admin → **Backup**: an Admin types a password and downloads one AES-256 ZIP made at that moment (`admin.backup_downloaded` in the audit log). Keep the ZIP off the server and its password in the password manager. |

The Admin ZIP (`poc-intel-backup-<date>.zip`) holds `pocintel.dump` (the database, without the pg-boss queue) and `manifest.json` (date, applied migrations and the `ENCRYPTION_KEY`), so a restore on a new server keeps every MFA enrolment even with a new `.env`. It opens with the password in 7-Zip or Keka; macOS Archive Utility cannot open AES ZIPs.

The dump holds the whole database: Users, PoCs, Notebooks, Report Data, Experiences, audit and logs. It does not hold:

- the `.env` (database password, `ENCRYPTION_KEY`, Root Administrator password, SMTP). Without the same `ENCRYPTION_KEY`, remembered Stellar credentials cannot be opened and SEs must enter them again; nothing else is lost. Keep a copy of the `.env` in the operators' password manager.
- `/opt/poc-intel/data/files` (rendered PDFs and their cache). Every file there is rebuilt on demand.

## Health signals

Audit → Overview → **System health** (Admins):

| Card | Red when | First look |
|---|---|---|
| Worker | no heartbeat for 90 s | [Worker stopped](#worker-stopped) |
| Last backup | none for 26 h | [Backup missing](#backup-missing) |
| Failed Syncs (24 h) | amber from one | Audit → Syncs: the error and the API calls of each Sync |
| Disk used | amber 80 %, red 90 % | [Disk filling up](#disk-filling-up) |

On the server, `docker compose ps` shows `api` and `worker` as `healthy`. The worker healthcheck reads the heartbeat file, so a stuck worker shows `unhealthy` there too. Docker does not restart an unhealthy container on its own: restart it by hand.

## Incidents

### Worker stopped

Syncs stay queued, PDF downloads time out, the Monday catalog refresh and the 03:00 retention purge do not run.

```bash
cd /opt/poc-intel/app
docker compose ps worker
docker compose logs --since 1h worker | tail -100
docker compose up -d --no-deps --force-recreate worker
```

A Sync left `running` by the dead worker is marked failed (`interrupted`) when the worker starts again; the SE starts it again from the PoC.

### Backup missing

```bash
tail -50 /opt/poc-intel/backups/backup.log
crontab -l | grep backup.sh            # missing: infra/scripts/install-cron.sh
infra/scripts/backup.sh                # run it now; the card turns green on the next refresh
```

### Disk filling up

```bash
df -h /opt/poc-intel
du -sh /opt/poc-intel/{data/*,backups}
docker system df
docker builder prune -f --filter until=24h     # build cache is the usual culprit
```

`deploy.sh` already prunes images and week-old build cache. Rendered PDFs are cache and can be deleted (`data/files/renders`).

### API down (the site does not load)

```bash
docker compose ps
docker compose logs --since 30m api web | tail -100
docker compose up -d --no-deps --force-recreate api web
```

If the database is the cause (`postgres` not healthy), check `docker compose logs postgres` and the disk first: PostgreSQL stops writing on a full disk.

### A deploy broke something

Deploys are a `git pull` and a rebuild, so a rollback is a deploy of the previous commit:

```bash
cd /opt/poc-intel/app
git log --oneline -5
git checkout <previous-commit>
SKIP_PULL=1 infra/scripts/deploy.sh
git checkout main                       # once the fix is pushed, deploy normally again
```

Migrations only move forward. When the bad deploy included a migration that the previous code cannot work with, restore the dump taken before the deploy instead (next section).

## Restore

### Prove the backups (monthly, and after changing backup.sh)

```bash
infra/scripts/restore-test.sh
```

It loads the newest dump into a throwaway database, compares the row counts of the main tables with the live ones and drops the copy. The live database is only read. It ends with `restore test: OK`.

### Restore on the same server

This replaces the live database with the dump. Take a dump of the current state first, even a broken one.

```bash
cd /opt/poc-intel/app
infra/scripts/backup.sh                                     # keeps the current state (rotates to 2)
ls -lt /opt/poc-intel/backups                               # pick the dump to restore
docker compose stop api worker
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --exit-on-error' < /opt/poc-intel/backups/<file>.dump
docker compose up -d api worker
docker compose ps
```

Then open the app, sign in, open a PoC and its Report, and check Audit → System health.

### Restore on a new server

1. Install Ubuntu 24.04 with Docker and the compose plugin, and the firewall rules in server-access.md.
2. Clone the repository into `/opt/poc-intel/app`. Put back the `.env` from the password manager, or create a new one with `infra/scripts/init-env.sh` (the Admin ZIP carries the old `ENCRYPTION_KEY`).
3. `infra/scripts/deploy.sh` builds and starts an empty stack; the API applies the migrations and creates the Root Administrator.
4. Sign in as the Root Administrator, open Admin → **Backup** → Restore, choose the ZIP and type its password. The restore runs in one transaction, applies the migrations newer than the backup, re-seals the MFA secrets with the new key and signs everyone out. Sign in again with an account from the backup.
   From a cron dump instead of the ZIP: copy it over and restore it as in the previous section.
5. `infra/scripts/install-cron.sh` to schedule the daily backups again.
6. Point the users to the new address if it changed (`SITE_ADDRESS` in the `.env`).

The restore refuses a backup taken by a newer version of the app (deploy the latest code first) and refuses to run while a Sync is queued or running. Before replacing anything it dumps the current database to `/opt/poc-intel/data/files/restore/pre-restore.dump`.
