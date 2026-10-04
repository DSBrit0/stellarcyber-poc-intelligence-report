-- A User can stop a running Sync: it ends as 'cancelled' and leaves no Report Data.
ALTER TABLE syncs DROP CONSTRAINT syncs_status_check;
ALTER TABLE syncs ADD CONSTRAINT syncs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled'));
