-- The Instance URL a Customer usually uses, to prefill new PoCs.
ALTER TABLE customers ADD COLUMN instance_url text;
-- A PoC created by "Run Sync" stays a Draft until its details are saved. Existing PoCs are complete.
ALTER TABLE pocs ADD COLUMN draft boolean NOT NULL DEFAULT false;
