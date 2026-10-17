-- Stellar Experiences (CONTEXT.md, "Stellar Experience"; ADR 0014): live, guided walks through the
-- pipeline that a Sales Engineer runs with the Customer Users of a PoC Notebook.
CREATE TABLE experiences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id            uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  name              text NOT NULL,
  profile           text NOT NULL CHECK (profile IN ('technical', 'executive')),
  status            text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'active', 'finished')),
  -- The Stage ids chosen, in pipeline order: a later change to the Stages never alters this list.
  stages            jsonb NOT NULL,
  -- The Presenter's Stage: every participant's view follows it.
  current_stage     text NOT NULL,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz
);
CREATE INDEX experiences_poc ON experiences (poc_id, created_at);
-- One Active Experience per PoC, so a Customer User always knows which one to join.
CREATE UNIQUE INDEX experiences_one_active ON experiences (poc_id) WHERE status = 'active';

-- Each participant's own Answer to a Stage's question.
CREATE TABLE experience_answers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  stage_id       text NOT NULL,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value          jsonb NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experience_id, stage_id, user_id)
);

-- How a Stage was settled: its Approved Answer, or Skipped by the Presenter.
CREATE TABLE experience_stage_results (
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  stage_id       text NOT NULL,
  outcome        text NOT NULL CHECK (outcome IN ('approved', 'skipped')),
  value          jsonb,
  answer_ids     jsonb NOT NULL DEFAULT '[]',
  decided_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experience_id, stage_id)
);
