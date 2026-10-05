-- A PoC Notebook is the PoC itself, before any Tenant (ADR 0010): the Report target is set later.
ALTER TABLE pocs
  ALTER COLUMN instance_url DROP NOT NULL,
  ALTER COLUMN tenant_id DROP NOT NULL,
  ALTER COLUMN period_start DROP NOT NULL,
  ALTER COLUMN period_end DROP NOT NULL;
-- Overview of the PoC Notebook (start date, sizing, contacts...); NULL when the PoC has no Notebook.
ALTER TABLE pocs ADD COLUMN notebook jsonb;

-- Every Notebook row is saved on its own, so two people editing different rows never collide.
CREATE TABLE poc_criteria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id      uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  position    double precision NOT NULL,
  text        text NOT NULL,
  status      text CHECK (status IN ('completed_success', 'completed_partial', 'completed_failed', 'ticket_open')),
  notes       text NOT NULL DEFAULT '',
  weight      smallint CHECK (weight BETWEEN 1 AND 5),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poc_criteria_poc ON poc_criteria (poc_id, position);

CREATE TABLE poc_meetings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id      uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  date        date,
  link        text NOT NULL DEFAULT '',
  passcode    text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  next_steps  text NOT NULL DEFAULT '',
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poc_meetings_poc ON poc_meetings (poc_id, date);

-- The Notebook Template (ADR 0012): what a new Notebook copies. kind: phase | group | item | note.
CREATE TABLE notebook_template_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text NOT NULL CHECK (section IN ('process')),
  kind        text NOT NULL CHECK (kind IN ('phase', 'group', 'item', 'note')),
  position    double precision NOT NULL,
  indent      smallint NOT NULL DEFAULT 0,
  -- {"pt-BR": "...", "en": "...", "es": "..."}; only pt-BR is required.
  text        jsonb NOT NULL,
  hidden      boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- A Notebook's own copy of the template, adjusted per PoC by its SE, Owner or an Admin.
CREATE TABLE poc_process_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id      uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('phase', 'group', 'item', 'note')),
  position    double precision NOT NULL,
  indent      smallint NOT NULL DEFAULT 0,
  text        jsonb NOT NULL,
  hidden      boolean NOT NULL DEFAULT false,
  status      text CHECK (status IN ('in_progress', 'completed', 'na')),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poc_process_items_poc ON poc_process_items (poc_id, position);
