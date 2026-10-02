# Performance measurements

Every Sync records its metrics in `syncs.metrics` (JSONB):
- the total time;
- milliseconds per collector or phase;
- per endpoint group: requests, retries, HTTP status counts, bytes, and latency p50/p95/max;
- the configured alert-paging concurrency and the peak number of requests in flight.

`infra/scripts/perf-baseline.sh` runs the same collection code for chosen Tenants, without writing to the database, and stores the results in `/opt/poc-intel/data/files/perf/<date>-<label>.json`.

## Method

- Run on `srv-poc-tool`, from the worker container, with direct network access (no proxy).
- One Tenant at a time (`TENANT_CONCURRENCY=1`), so Tenants do not compete for the Instance.
- Period: the last 30 complete days.
- Each change is measured against the latest baseline, on the same Tenants, at a close time of day. The Instances are live and their load varies.
- What to watch:
  - `tactics` (alert paging) dominates the total;
  - the `cases/:id/alerts` p50/p95 latency, and status 429/5xx, show whether the Instance is pushing back.

## Runs

| Date | Label | Concurrency | Notes | File |
|---|---|---|---|---|
| | | | | |
