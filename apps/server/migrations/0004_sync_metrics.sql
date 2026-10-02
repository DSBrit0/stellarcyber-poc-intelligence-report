-- Performance metrics of each Sync (phases, requests per endpoint, latency quantiles): the baseline
-- that performance changes are measured against.
ALTER TABLE syncs ADD COLUMN metrics jsonb;
