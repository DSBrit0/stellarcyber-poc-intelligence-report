-- A PoC is Active until its Owner or an Admin closes it with a Deal Result; it can be reopened. Only a
-- Closed PoC is subject to the Retention Period, counted from its closing (ADR 0016).
ALTER TABLE pocs
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN closed_by uuid,
  ADD COLUMN deal_result text CHECK (deal_result IN ('won', 'lost', 'no_decision')),
  ADD CONSTRAINT pocs_closed_has_result CHECK ((closed_at IS NULL) = (deal_result IS NULL));

CREATE INDEX pocs_closed_at ON pocs (closed_at) WHERE closed_at IS NOT NULL;
