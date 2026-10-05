-- The Data Source Catalog: log parsers and Connectors read from the official documentation.
CREATE TABLE catalog_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL CHECK (kind IN ('parser', 'connector')),
  -- The normalised name: what a refresh matches on.
  key            text NOT NULL,
  name           text NOT NULL,
  port           text NOT NULL DEFAULT '',
  category       text NOT NULL DEFAULT '',
  source         text NOT NULL DEFAULT '',
  detail         text NOT NULL DEFAULT '',
  doc_url        text NOT NULL DEFAULT '',
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Set when a refresh no longer finds it; PoC Notebooks that use it keep it, marked as removed.
  removed_at     timestamptz,
  UNIQUE (kind, key)
);

-- A PoC Notebook's Data Sources and Connectors, picked from the catalog (or typed when missing).
CREATE TABLE poc_data_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id      uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('parser', 'connector')),
  catalog_id  uuid REFERENCES catalog_entries(id) ON DELETE SET NULL,
  name        text NOT NULL,
  port        text NOT NULL DEFAULT '',
  status      text CHECK (status IN ('in_progress', 'ingesting', 'ticket_open')),
  notes       text NOT NULL DEFAULT '',
  position    double precision NOT NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poc_data_sources_poc ON poc_data_sources (poc_id, kind, position);

-- The two official pages the weekly refresh reads; an Admin can point them elsewhere at any time.
INSERT INTO settings (key, value) VALUES ('catalog_sources', '{
  "parsersUrl": "https://docs.stellarcyber.ai/prod-docs/7.0.xs/Configure/Ports/Firewall-Ports-for-Parsers.htm",
  "connectorsUrl": "https://docs.stellarcyber.ai/prod-docs/7.0.xs/Configure/Connectors/1-Connectors-List.htm"
}') ON CONFLICT (key) DO NOTHING;
