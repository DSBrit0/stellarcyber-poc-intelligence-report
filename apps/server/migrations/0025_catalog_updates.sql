-- The Data Source Catalog's history: every update written (by an Admin or the weekly run), with the
-- parsers and Connectors it brought in and the ones it removed.
CREATE TABLE catalog_updates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at           timestamptz NOT NULL DEFAULT now(),
  -- 'manual' (an Admin's "Update now"), 'scheduled' (the weekly run), 'backfill' (rebuilt below).
  trigger          text NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'backfill')),
  user_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  version_segment  text,
  version_label    text,
  parsers          integer,
  connectors       integer,
  -- [{ "kind": "parser" | "connector", "name": "..." }], by name.
  added            jsonb NOT NULL DEFAULT '[]',
  removed          jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX catalog_updates_run_at ON catalog_updates (run_at DESC);

-- The history so far, rebuilt from when each entry was first seen and when it was removed (to the
-- minute: one update writes all its rows within it). An entry removed and later brought back only
-- shows its latest removal; the first group is the initial import.
WITH events AS (
  SELECT date_trunc('minute', first_seen_at) AS at, kind, name, 'added' AS change FROM catalog_entries
  UNION ALL
  SELECT date_trunc('minute', removed_at), kind, name, 'removed' FROM catalog_entries WHERE removed_at IS NOT NULL
)
INSERT INTO catalog_updates (run_at, trigger, added, removed)
SELECT
  at,
  'backfill',
  coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'name', name) ORDER BY name) FILTER (WHERE change = 'added'), '[]'),
  coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'name', name) ORDER BY name) FILTER (WHERE change = 'removed'), '[]')
FROM events
GROUP BY at;
