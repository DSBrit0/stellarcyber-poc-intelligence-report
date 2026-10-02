-- A Sync may collect a period other than the PoC's (e.g. re-running a Report for specific dates).
-- NULL means the PoC's period.
ALTER TABLE syncs ADD COLUMN period_start date;
ALTER TABLE syncs ADD COLUMN period_end date;
ALTER TABLE syncs ADD CONSTRAINT syncs_period_both CHECK ((period_start IS NULL) = (period_end IS NULL));
