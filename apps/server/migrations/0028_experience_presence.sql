-- Whether a participant is looking at the session: their page hidden, the window out of focus or the
-- pointer off the page marks them away until they come back (the floating names above the Stack).
ALTER TABLE experience_participants ADD COLUMN away boolean NOT NULL DEFAULT false;
-- Who is leading the session: the runner who last moved it (activated it, changed Stage, phase, Briefing
-- or scene). Everyone else in the session shows above the Stack.
ALTER TABLE experiences ADD COLUMN presenter_id uuid;
