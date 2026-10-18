-- One Sync at a time per PoC, enforced by the database: the route checked for an active Sync and then
-- inserted, so two requests at once (a double click, two tabs) could both start one.
CREATE UNIQUE INDEX syncs_one_active ON syncs (poc_id) WHERE status IN ('queued', 'running');
