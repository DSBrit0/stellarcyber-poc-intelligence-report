-- Each Stage opens on its Briefing; the Presenter then opens its question (CONTEXT.md, "Briefing").
ALTER TABLE experiences ADD COLUMN current_phase text NOT NULL DEFAULT 'briefing' CHECK (current_phase IN ('briefing', 'question'));

-- Customer Questions asked during a Stage, and the Sales Engineer's Reply.
CREATE TABLE experience_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  stage_id       text NOT NULL,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  text           text NOT NULL,
  reply          text,
  -- Answered aloud during the session, with no written Reply.
  answered_live  boolean NOT NULL DEFAULT false,
  replied_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  replied_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX experience_questions_experience ON experience_questions (experience_id, created_at);
