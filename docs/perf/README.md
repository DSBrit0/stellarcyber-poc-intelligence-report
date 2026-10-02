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
| 2026-10-01 23:34 | v0-c16 | 16 | First baseline. The per-endpoint request counts and latencies of this run accumulated across the Tenants of each Instance (fixed afterwards); the totals, phases and page counts are valid. | `20261001-2334-v0-c16.json` |

### v0 — current code, concurrency 16 (2026-10-01)

| Tenant | Cases | Key Cases' alert pages | Sync total | Alert paging (`tactics`) | Share of the total |
|---|---|---|---|---|---|
| poc / NetUno | 1,785 | 1,023 | 93.3 s | 91.0 s | 98% |
| poc / BSmart | 2,065 | 540 | 81.2 s | 75.7 s | 93% |
| poc / Gob de Oaxaca | 2,052 | 542 | 73.5 s | 68.4 s | 93% |
| poc / salesdemo | 683 | 563 | 45.6 s | 44.3 s | 97% |
| clearwater / Clearwater_Security | 1,458 | 488 | 14.3 s | 7.1 s | 50% (the case list took 7.2 s) |
| poc / EmberIT | 295 | 160 | 12.8 s | 11.9 s | 93% |
| poc-eu / Keune | 432 | 110 | 6.0 s | 4.4 s | 73% |
| poc-eu / salesdemo | 164 | 104 | 5.7 s | 4.9 s | 86% |
| poc-eu / Abacus POV | 177 | 116 | 5.5 s | 4.3 s | 78% |

Findings:

- **Alert paging is the whole problem.** It takes 93–98% of the time on the poc Instance.
- **The Instance's latency per alert page sets the speed, not this server.** The `cases/:id/alerts` p50 is roughly:
  - about 1.5–1.9 s on poc;
  - about 0.15 s on clearwater;
  - about 0.5 s on poc-eu.

  These are rough figures, because the per-endpoint latencies of this run are skewed by the bug noted above. The same 488–542 pages take 7 s on clearwater and 68–76 s on poc.
- **Throughput depends only on concurrency.** On poc, the time follows pages × p50 ÷ 16 (NetUno: 1,023 × ~1.4 s ÷ 16 ≈ 90 s). The peak in flight always reached 16, the configured limit. With no 429 or 5xx, more concurrency should scale almost linearly until the Instance's latency starts to rise.
- **HTTP 403 does not slow anything.** It only marks Cases whose alerts the key cannot read (salesdemo).
- **Next experiment:** concurrency 32 and 64 on the same Tenants, then incremental Sync.

### v1 — concurrency 16 vs 32 vs 64 (2026-10-01 23:51 – 2026-10-02 00:01)

Same 9 Tenants, run one after another (`v1-c16`, `v1-c32`, `v1-c64`), with correct per-Tenant statistics.

| Tenant | c16 total | c32 total | c64 total | c64 vs c16 | Alert p50 c16 → c64 |
|---|---|---|---|---|---|
| poc / NetUno | 99.3 s | 111.2 s | 56.0 s | −44% | 1.3 s → 2.4 s |
| poc / BSmart | 72.9 s | 58.5 s | 44.5 s | −39% | 1.7 s → 3.4 s |
| poc / Gob de Oaxaca | 70.9 s | 64.3 s | 43.9 s | −38% | 1.8 s → 3.0 s |
| poc / salesdemo | 45.4 s | 33.5 s | 27.7 s | −39% | 1.1 s → 2.0 s |
| clearwater / Clearwater_Security | 14.0 s | 12.2 s | 12.1 s | −14% | 0.17 s → 0.55 s |
| poc / EmberIT | 10.8 s | 9.4 s | 9.0 s | −17% | |
| poc-eu (3 Tenants) | 5.5–6.5 s | 4.4–4.7 s | 3.9–4.0 s | −30% | |

Findings:

- **Concurrency 64 cuts the large poc Tenants by about 40%, not 75%.** The Instance's latency per page roughly doubles as concurrency rises, so it is saturating on its side.
- **c32 was noisy.** On NetUno, the p95 reached 11 s in that run, so it took longer than c16. Instance load varies between runs.
- **Failed pages are network timeouts:** 2 at c16, 27 at c32 and 12 at c64. The 20 s per-page timeout is too short when the p95 reaches 8–14 s, and the client retries HTTP 429/5xx but not network errors. Those pages lose their tactics.
- **Recommended change:**
  - concurrency 48–64;
  - one retry on a network error or timeout;
  - an alert-page timeout of 45 s.

  The structural gain (incremental Sync) is still the bigger lever for repeated Syncs.
